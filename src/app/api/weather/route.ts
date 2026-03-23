import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Maps Open-Meteo WMO weather codes to a mood + label for the reco engine.
// https://open-meteo.com/en/docs#weathervariables
function weatherMood(code: number, tempC: number): { condition: string; label: string; mood: string } {
  if (code === 0) {
    if (tempC >= 25) return { condition: "sunny-hot",  label: "Sunny & warm",   mood: "upbeat"      };
    if (tempC <= 5)  return { condition: "sunny-cold", label: "Clear & cold",   mood: "crisp"       };
    return             { condition: "sunny",      label: "Clear skies",    mood: "upbeat"      };
  }
  if (code <= 3)   return { condition: "cloudy",     label: "Partly cloudy",  mood: "mellow"      };
  if (code <= 48)  return { condition: "foggy",      label: "Foggy",          mood: "atmospheric" };
  if (code <= 67)  return { condition: "rainy",      label: "Rainy",          mood: "melancholic" };
  if (code <= 77)  return { condition: "snowy",      label: "Snowy",          mood: "cozy"        };
  if (code <= 82)  return { condition: "rainy",      label: "Rain showers",   mood: "melancholic" };
  if (code <= 86)  return { condition: "snowy",      label: "Snow showers",   mood: "cozy"        };
  return             { condition: "stormy",     label: "Thunderstorm",   mood: "intense"     };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load stored coordinates
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("city_name, latitude, longitude")
    .eq("user_id", userId)
    .single();

  if (!profile?.latitude || !profile?.longitude) {
    return NextResponse.json({ error: "No location set" }, { status: 404 });
  }

  const { latitude, longitude, city_name } = profile;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode,precipitation&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // cache 1 hour
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

    const data = await res.json();
    const current = data.current || {};
    const code    = current.weathercode  ?? 0;
    const tempC   = current.temperature_2m ?? 20;
    const precip  = current.precipitation  ?? 0;
    const { condition, label, mood } = weatherMood(code, tempC);

    return NextResponse.json({
      city_name,
      condition,
      label,
      mood,
      temperature_c: Math.round(tempC),
      precipitation: precip,
      weather_code: code,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Weather fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
