"use client";

import { useState, useEffect, useCallback } from "react";

const RAW_COLLECTION = [{"id":1,"artist":"Jigsaw (3)","title":"Jigsaw","label":"20th Century Records","year_pressed":1977,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":2,"artist":"Supertramp","title":"The Autobiography Of Supertramp","label":"A&M Records","year_pressed":1986,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":3,"artist":"Peter Frampton","title":"Frampton Comes Alive!","label":"A&M Records","year_pressed":1976,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Album, Mix"},{"id":4,"artist":"Captain And Tennille","title":"Greatest Hits","label":"A&M Records","year_pressed":1977,"genre":"Pop","condition":"","for_sale":false,"format":"LP, Comp, Pit"},{"id":5,"artist":"Captain And Tennille","title":"Greatest Hits","label":"A&M Records","year_pressed":1977,"genre":"EN VENTA","condition":"","for_sale":true,"format":"LP, Comp, Ter"},{"id":6,"artist":"Bryan Adams","title":"Reckless","label":"A&M Records","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album, Ind"},{"id":7,"artist":"Styx","title":"Gold Series","label":"A&M Records","year_pressed":1987,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":8,"artist":"38 Special (2)","title":"Flashback","label":"A&M Records","year_pressed":1987,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":9,"artist":"38 Special (2)","title":"Rock & Roll Strategy","label":"A&M Records","year_pressed":1988,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":10,"artist":"Go-Go's","title":"Greatest","label":"A&M Records","year_pressed":2020,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":11,"artist":"Joe Walsh","title":"The Best Of Joe Walsh","label":"ABC Records","year_pressed":1978,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":12,"artist":"The Rolling Stones","title":"Hot Rocks 1964-1971","label":"ABKCO","year_pressed":2013,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":13,"artist":"Thurston Harris","title":"Little Bitty Pretty One","label":"Aladdin","year_pressed":1983,"genre":"Blues","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":14,"artist":"The Sweet","title":"Sweet 16: It's It's....Sweet's Hits","label":"Anagram Records","year_pressed":1984,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":15,"artist":"Ace (7)","title":"Five-A-Side","label":"Anchor","year_pressed":1975,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":16,"artist":"The Beatles","title":"1962-1966","label":"Apple Records","year_pressed":1973,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":17,"artist":"Ringo Starr","title":"Blast From Your Past","label":"Apple Records","year_pressed":1975,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":18,"artist":"The Beatles","title":"1967-1970","label":"Apple Records","year_pressed":1975,"genre":"Rock & Roll","condition":"Very Good (VG)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":19,"artist":"Earth, Wind & Fire","title":"The Very Best Of","label":"Arcade","year_pressed":1989,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":20,"artist":"Electric Light Orchestra","title":"The Very Best Of ELO","label":"Arcade","year_pressed":1990,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":21,"artist":"Juan Gabriel","title":"Todo","label":"Ariola","year_pressed":1983,"genre":"Latin","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":22,"artist":"Silver (10)","title":"Silver","label":"Arista","year_pressed":1976,"genre":"Soft Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album"},{"id":23,"artist":"Eric Carmen","title":"The Best Of Eric Carmen","label":"Arista","year_pressed":1988,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":24,"artist":"Air Supply","title":"Greatest Hits","label":"Arista","year_pressed":1983,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":25,"artist":"The Monkees","title":"The Monkees Greatest Hits","label":"Arista","year_pressed":1976,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp, RE"},{"id":26,"artist":"The Alan Parsons Project","title":"The Best of The Alan Parsons Project Volume 2","label":"Arista","year_pressed":1987,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":27,"artist":"The Alan Parsons Project","title":"The Best Of The Alan Parsons Project","label":"Arista","year_pressed":1983,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":28,"artist":"Jackson Browne","title":"Running On Empty","label":"Asylum Records","year_pressed":1977,"genre":"EN VENTA","condition":"Very Good (VG)","for_sale":true,"format":"LP, Album"},{"id":29,"artist":"Orleans","title":"Let There Be Music","label":"Asylum Records","year_pressed":1975,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":30,"artist":"Orleans","title":"Waking And Dreaming","label":"Asylum Records","year_pressed":1976,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Album"},{"id":31,"artist":"Jackson Browne","title":"Jackson Browne","label":"Asylum Records","year_pressed":1975,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album, RE"},{"id":32,"artist":"Eagles","title":"Their Greatest Hits Volumes 1 & 2","label":"Asylum Records","year_pressed":2017,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp + Box"},{"id":33,"artist":"Yes","title":"Big Generator","label":"ATCO Records","year_pressed":1987,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":34,"artist":"AC/DC","title":"Let There Be Rock","label":"ATCO Records","year_pressed":1977,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":35,"artist":"Phil Collins","title":"The Singles","label":"Atlantic","year_pressed":2018,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":36,"artist":"Bad Company","title":"10 From 6","label":"Atlantic","year_pressed":1985,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":37,"artist":"AC/DC","title":"High Voltage","label":"Atlantic","year_pressed":1976,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Album"},{"id":38,"artist":"Simple Plan","title":"No Pads, No Helmets...Just Balls","label":"Atlantic","year_pressed":2023,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":39,"artist":"Led Zeppelin","title":"Untitled","label":"Atlantic","year_pressed":2014,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE, RM"},{"id":40,"artist":"The Darkness","title":"Permission To Land","label":"Atlantic","year_pressed":2023,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":41,"artist":"Stardust","title":"Music Sounds Better With You","label":"Because Music","year_pressed":2022,"genre":"Electronic","condition":"Near Mint (NM or M-)","for_sale":false,"format":"12\", Single, RE"},{"id":42,"artist":"Motley Crue","title":"Greatest Hits","label":"BMG","year_pressed":2024,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":43,"artist":"KC & The Sunshine Band","title":"Greatest Hits","label":"BR Music","year_pressed":1986,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":44,"artist":"Selena","title":"Ones","label":"Capitol Latin","year_pressed":2020,"genre":"Latin","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":45,"artist":"Bob Seger And The Silver Bullet Band","title":"Greatest Hits","label":"Capitol Records","year_pressed":2017,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":46,"artist":"Bob Seger And The Silver Bullet Band","title":"Live Bullet","label":"Capitol Records","year_pressed":1976,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Album"},{"id":47,"artist":"Juice Newton","title":"Greatest Hits","label":"Capitol Records","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":48,"artist":"Katrina And The Waves","title":"Katrina And The Waves","label":"Capitol Records","year_pressed":1985,"genre":"Pop Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album"},{"id":49,"artist":"Heart","title":"Heart","label":"Capitol Records","year_pressed":1985,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":50,"artist":"Poison","title":"Open Up And Say ...Ahh!","label":"Capitol Records","year_pressed":1988,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":51,"artist":"Grand Funk Railroad","title":"Grand Funk Hits","label":"Capitol Records","year_pressed":1976,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":52,"artist":"The Knack","title":"Get The Knack","label":"Capitol Records","year_pressed":1979,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":53,"artist":"Dr. Hook","title":"Greatest Hits","label":"Capitol Records","year_pressed":1980,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":54,"artist":"The Sweet","title":"Desolation Boulevard","label":"Capitol Records","year_pressed":1975,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":55,"artist":"Tavares","title":"The Best Of Tavares","label":"Capitol Records","year_pressed":1977,"genre":"Funk/Soul","condition":"","for_sale":false,"format":"LP, Comp"},{"id":56,"artist":"America","title":"View From The Ground","label":"Capitol Records","year_pressed":1982,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":57,"artist":"Dr. Hook","title":"Pleasure & Pain","label":"Capitol Records","year_pressed":1978,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":58,"artist":"The Sons Of Champlin","title":"Loosen Up Naturally","label":"Capitol Records","year_pressed":1969,"genre":"EN VENTA","condition":"Good (G)","for_sale":true,"format":"2xLP, Album"},{"id":59,"artist":"The Beach Boys","title":"20 Golden Greats","label":"Capitol Records","year_pressed":1976,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":60,"artist":"Wings","title":"Wings Greatest","label":"Capitol Records","year_pressed":1978,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":61,"artist":"Bee Gees","title":"Timeless (The All-Time Greatest Hits)","label":"Capitol Records","year_pressed":2018,"genre":"Soft Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":62,"artist":"Aerosmith","title":"Greatest Hits","label":"Capitol Records","year_pressed":2023,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":63,"artist":"Frank Sinatra","title":"Ultimate Sinatra","label":"Capitol Records","year_pressed":2015,"genre":"Pop","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":64,"artist":"The Allman Brothers Band","title":"The Road Goes On Forever","label":"Capricorn Records","year_pressed":1975,"genre":"Blues","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":65,"artist":"Eddie Money","title":"Greatest Hits - Sound Of Money","label":"CBS","year_pressed":1989,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":66,"artist":"Chicago","title":"Los Grandes Exitos De Chicago","label":"CBS","year_pressed":1976,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":67,"artist":"Chicago","title":"Greatest Hits, Volume II","label":"CBS","year_pressed":1981,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":68,"artist":"Men At Work","title":"Business As Usual","label":"CBS","year_pressed":1982,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":69,"artist":"Men At Work","title":"Cargo","label":"CBS","year_pressed":1983,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":70,"artist":"Billy Joel","title":"Greatest Hits Volume I (1973-1980)","label":"CBS","year_pressed":1985,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":71,"artist":"Loverboy","title":"Big Ones","label":"CBS","year_pressed":1989,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":72,"artist":"Johnny Mathis","title":"Johnny's Greatest Hits","label":"CBS","year_pressed":1965,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Comp"},{"id":73,"artist":"Santana","title":"Serie De Coleccion 15 Autenticos Exitos","label":"CBS","year_pressed":1984,"genre":"Classic Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp"},{"id":74,"artist":"Billy Joel","title":"Greatest Hits Volumen II (1980-1985)","label":"CBS","year_pressed":1986,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":75,"artist":"Billy Idol","title":"Idol Songs - 11 Of The Best","label":"Chrysalis","year_pressed":1988,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":76,"artist":"Pat Benatar","title":"Wide Awake In Dreamland","label":"Chrysalis","year_pressed":1988,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":77,"artist":"Pat Benatar","title":"Best Shots","label":"Chrysalis","year_pressed":1989,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp, RM"},{"id":78,"artist":"Blondie","title":"The Best Of Blondie","label":"Chrysalis","year_pressed":1981,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":79,"artist":"Scandal","title":"Scandal","label":"Columbia","year_pressed":1982,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"12\", EP"},{"id":80,"artist":"Chicago","title":"Chicago XIV","label":"Columbia","year_pressed":1980,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":81,"artist":"Scandal Featuring Patty Smyth","title":"Warrior","label":"Columbia","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":82,"artist":"Steve Perry","title":"Street Talk","label":"Columbia","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":83,"artist":"Enanitos Verdes","title":"Habitaciones Extranas","label":"Columbia","year_pressed":1988,"genre":"Rock en Espanol","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":84,"artist":"The Hooters","title":"Nervous Night","label":"Columbia","year_pressed":1985,"genre":"Pop Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album"},{"id":85,"artist":"Hombres G","title":"Un Par De Palabras","label":"Columbia","year_pressed":1986,"genre":"Rock en Espanol","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":86,"artist":"The Outfield","title":"Voices Of Babylon","label":"Columbia","year_pressed":1989,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":87,"artist":"Simon & Garfunkel","title":"Simon And Garfunkel's Greatest Hits","label":"Columbia","year_pressed":1972,"genre":"Soft Rock","condition":"Good (G)","for_sale":false,"format":"LP, Comp, RE"},{"id":88,"artist":"Janis Joplin","title":"Janis Joplin's Greatest Hits","label":"Columbia","year_pressed":1983,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":89,"artist":"Loggins And Messina","title":"The Best Of Friends","label":"Columbia","year_pressed":1976,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":90,"artist":"Bob Dylan","title":"Bob Dylan's Greatest Hits","label":"Columbia","year_pressed":null,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp, RE"},{"id":91,"artist":"AC/DC","title":"Back In Black","label":"Columbia","year_pressed":2003,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE, RM, 180"},{"id":92,"artist":"Daft Punk","title":"Random Access Memories","label":"Columbia","year_pressed":2013,"genre":"Electronic","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Album, 180"},{"id":93,"artist":"Boz Scaggs","title":"Hits!","label":"Columbia","year_pressed":1980,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":94,"artist":"The Outfield","title":"Play Deep","label":"Columbia","year_pressed":1985,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":95,"artist":"Chicago","title":"Chicago X","label":"Columbia","year_pressed":1976,"genre":"Soft Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album"},{"id":96,"artist":"Johnny Mathis","title":"Johnny Mathis' All-Time Greatest Hits","label":"Columbia","year_pressed":1972,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"2xLP, Comp"},{"id":97,"artist":"Toto","title":"40 Trips Around The Sun","label":"Columbia","year_pressed":2018,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RM"},{"id":98,"artist":"Journey","title":"Greatest Hits 2","label":"Columbia","year_pressed":2011,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RM"},{"id":99,"artist":"Mountain","title":"The Best Of Mountain","label":"Columbia","year_pressed":1973,"genre":"Classic Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp"},{"id":100,"artist":"Cerrone","title":"Cerrone 3 - Supernature","label":"Cotillion","year_pressed":1977,"genre":"Electronic","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album, Mixed"},{"id":101,"artist":"George Harrison","title":"Best Of Dark Horse 1976-1989","label":"Dark Horse Records","year_pressed":1989,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":102,"artist":"Miles Davis","title":"Kind Of Blue","label":"DOL","year_pressed":2017,"genre":"Jazz","condition":"Mint (M)","for_sale":false,"format":"LP, RE"},{"id":103,"artist":"Steppenwolf","title":"Gold (Their Great Hits)","label":"Dunhill","year_pressed":1972,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":104,"artist":"The Cars","title":"Heartbeat City","label":"Elektra","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":105,"artist":"Carly Simon","title":"Boys In The Trees","label":"Elektra","year_pressed":1978,"genre":"EN VENTA","condition":"Near Mint (NM or M-)","for_sale":true,"format":"LP, Album"},{"id":106,"artist":"Eddie Rabbitt","title":"The Best Of Eddie Rabbitt","label":"Elektra","year_pressed":1979,"genre":"Country","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":107,"artist":"Eddie Rabbitt","title":"Horizon","label":"Elektra","year_pressed":1980,"genre":"Country","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":108,"artist":"Grover Washington Jr.","title":"Winelight","label":"Elektra","year_pressed":1980,"genre":"Jazz","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":109,"artist":"Bread","title":"Anthology Of Bread","label":"Elektra","year_pressed":1985,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":110,"artist":"The Doors","title":"Greatest Hits","label":"Elektra","year_pressed":2020,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":111,"artist":"Al Stewart","title":"Chronicles - The Best Of Al Stewart","label":"EMI","year_pressed":1991,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":112,"artist":"Duran Duran","title":"Decade","label":"EMI","year_pressed":1990,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":113,"artist":"John Lennon","title":"The John Lennon Collection","label":"EMI","year_pressed":1982,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":114,"artist":"Whitesnake","title":"1987","label":"EMI","year_pressed":1987,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":115,"artist":"George Harrison","title":"The Best Of George Harrison","label":"EMI","year_pressed":1976,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":116,"artist":"Stray Cats","title":"Built For Speed","label":"EMI America","year_pressed":1982,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":117,"artist":"Roxette","title":"Look Sharp!","label":"EMI USA","year_pressed":1988,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":118,"artist":"Olivia Newton-John","title":"Olivia's Greatest Hits","label":"EMI","year_pressed":1982,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":119,"artist":"Poison","title":"Flesh & Blood","label":"EMI","year_pressed":1990,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":120,"artist":"The Romantics","title":"In Heat","label":"Epic","year_pressed":1983,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":121,"artist":"Michael Jackson","title":"Off The Wall","label":"Epic","year_pressed":1979,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":122,"artist":"The Charlie Daniels Band","title":"Million Mile Reflections","label":"Epic","year_pressed":1979,"genre":"Country","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":123,"artist":"Boston","title":"Boston","label":"Epic","year_pressed":null,"genre":"Hard Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album, RE"},{"id":124,"artist":"George Michael","title":"Faith","label":"Epic","year_pressed":1987,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":125,"artist":"Cheap Trick","title":"Lap Of Luxury","label":"Epic","year_pressed":1988,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":126,"artist":"The Zombies","title":"Time Of The Zombies","label":"Epic","year_pressed":1979,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp, Mono, RE"},{"id":127,"artist":"REO Speedwagon","title":"Hi Infidelity","label":"Epic","year_pressed":1980,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":128,"artist":"Heart","title":"Greatest Hits / Live","label":"Epic","year_pressed":null,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":129,"artist":"Cheap Trick","title":"Authorized Greatest Hits","label":"Epic","year_pressed":2022,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":130,"artist":"Good Charlotte","title":"Good Morning Revival","label":"Epic","year_pressed":2023,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":131,"artist":"Michael Jackson","title":"Thriller","label":"Epic","year_pressed":2008,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Pic, RE"},{"id":132,"artist":"Jimi Hendrix","title":"Experience Hendrix - The Best Of Jimi Hendrix","label":"Experience Hendrix","year_pressed":2017,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":133,"artist":"Creedence Clearwater Revival","title":"Chronicle - The 20 Greatest Hits","label":"Fantasy","year_pressed":1976,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":134,"artist":"Creedence Clearwater Revival","title":"More Creedence Gold","label":"Fantasy","year_pressed":null,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Comp, RE"},{"id":135,"artist":"The Cure","title":"Greatest Hits","label":"Fiction Records","year_pressed":2017,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":136,"artist":"The Cars","title":"Greatest Hits","label":"Friday Music","year_pressed":2013,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":137,"artist":"Mikel","title":"Poke & Chill","label":"GameChops","year_pressed":2022,"genre":"Electronic","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Album"},{"id":138,"artist":"Don Henley","title":"Building The Perfect Beast","label":"Geffen Records","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":139,"artist":"Lynyrd Skynyrd","title":"Skynyrd's Innyrds / Their Greatest Hits","label":"Geffen Records","year_pressed":2018,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":140,"artist":"Nirvana","title":"Nirvana","label":"Geffen Records","year_pressed":2015,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":141,"artist":"Tom Petty And The Heartbreakers","title":"Greatest Hits","label":"Geffen Records","year_pressed":2016,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":142,"artist":"Guns N' Roses","title":"Greatest Hits","label":"Geffen Records","year_pressed":2020,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":143,"artist":"Blink-182","title":"Greatest Hits","label":"Geffen Records","year_pressed":2022,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":144,"artist":"Queen","title":"Greatest Hits","label":"Hollywood Records","year_pressed":2016,"genre":"Classic Rock","condition":"Mint (M)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":145,"artist":"Queen","title":"Greatest Hits II","label":"Hollywood Records","year_pressed":2017,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":146,"artist":"Braxton Burks","title":"Johto Legends: Music From Pokemon Gold & Silver","label":"Iam8bit","year_pressed":2018,"genre":"Classical","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Ltd"},{"id":147,"artist":"Duncan Dhu","title":"El Grito Del Tiempo","label":"im Discos","year_pressed":1988,"genre":"Rock en Espanol","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":148,"artist":"John Coltrane","title":"A Love Supreme","label":"Impulse!","year_pressed":2021,"genre":"Jazz","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":149,"artist":"No Doubt","title":"Icon","label":"Interscope Records","year_pressed":2020,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":150,"artist":"Bob Marley & The Wailers","title":"Legend - The Best Of Bob Marley And The Wailers","label":"Island Records","year_pressed":1984,"genre":"Reggae","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":151,"artist":"Steve Winwood","title":"Chronicles","label":"Island Records","year_pressed":1988,"genre":"Pop Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp"},{"id":152,"artist":"U2","title":"U218 Singles","label":"Island Records","year_pressed":2006,"genre":"Pop Rock","condition":"Mint (M)","for_sale":false,"format":"2xLP, Comp"},{"id":153,"artist":"Bon Jovi","title":"Greatest Hits","label":"Island Records","year_pressed":2024,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":154,"artist":"The Killers","title":"Direct Hits","label":"Island Records","year_pressed":2017,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":155,"artist":"Sum 41","title":"All The Good Sh** (14 Solid Gold Hits 2000-2008)","label":"Island Records","year_pressed":2023,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":156,"artist":"Bon Iver","title":"For Emma, Forever Ago","label":"Jagjaguwar","year_pressed":2023,"genre":"Country","condition":"","for_sale":false,"format":"LP, RE"},{"id":157,"artist":"The Lovin' Spoonful","title":"The Very Best Of The Lovin' Spoonful","label":"Kama Sutra","year_pressed":1972,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp, RE"},{"id":158,"artist":"Juan Luis Guerra 4.40","title":"Bachata Rosa","label":"Karen Records","year_pressed":1991,"genre":"Latin","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album"},{"id":159,"artist":"Kenny Rogers","title":"20 Grandes Exitos","label":"Liberty","year_pressed":1983,"genre":"EN VENTA","condition":"Very Good (VG)","for_sale":true,"format":"LP, Comp"},{"id":160,"artist":"The 50 Guitars Of Tommy Garrett","title":"50 Guitars Limited Edition","label":"Liberty","year_pressed":1966,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Comp"},{"id":161,"artist":"Dorothy Moore","title":"Misty Blue","label":"Malaco Records","year_pressed":1976,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":162,"artist":"The John Coltrane Quartet","title":"Ballads","label":"MCA Impulse!","year_pressed":1987,"genre":"Jazz","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, RE, RM"},{"id":163,"artist":"Steely Dan","title":"Gold","label":"MCA Records","year_pressed":1982,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":164,"artist":"Steely Dan","title":"Greatest Hits (1972-1978)","label":"MCA Records","year_pressed":1984,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":165,"artist":"Night Ranger","title":"Midnight Madness","label":"MCA Records","year_pressed":1984,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":166,"artist":"Night Ranger","title":"7 Wishes","label":"MCA Records","year_pressed":1985,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":167,"artist":"Dan Hartman","title":"I Can Dream About You","label":"MCA Records","year_pressed":1984,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":168,"artist":"The Mamas & The Papas","title":"Greatest Hits","label":"MCA Records","year_pressed":1981,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":169,"artist":"Steely Dan","title":"Can't Buy A Thrill","label":"MCA Records","year_pressed":1979,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, RE"},{"id":170,"artist":"Donna Summer","title":"The Summer Collection -Greatest Hits-","label":"Mercury","year_pressed":1985,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":171,"artist":"Bachman-Turner Overdrive","title":"Best Of B.T.O. (So Far)","label":"Mercury","year_pressed":1976,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":172,"artist":"The Animals","title":"The Best Of The Animals","label":"MGM Records","year_pressed":null,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp, RE"},{"id":173,"artist":"Commodores","title":"Greatest Hits","label":"Motown","year_pressed":1978,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":174,"artist":"The Jackson 5","title":"Greatest Hits","label":"Motown","year_pressed":1971,"genre":"Funk/Soul","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp"},{"id":175,"artist":"Bill Haley And His Comets","title":"Rock N Roll Great","label":"Music For Pleasure","year_pressed":1987,"genre":"Rock & Roll","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp"},{"id":176,"artist":"Kool & The Gang","title":"Collected","label":"Music On Vinyl","year_pressed":2018,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":177,"artist":"Journey","title":"Greatest Hits","label":"Music On Vinyl","year_pressed":2011,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":178,"artist":"The Romantics","title":"The Romantics","label":"Nemperor Records","year_pressed":1980,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":179,"artist":"Black Sabbath","title":"Greatest Hits","label":"Nems","year_pressed":1977,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":180,"artist":"Prince","title":"The Hits 2","label":"NPG Records","year_pressed":2022,"genre":"Funk/Soul","condition":"Mint (M)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":181,"artist":"Prince","title":"The Hits 1","label":"NPG Records","year_pressed":2022,"genre":"Funk/Soul","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":182,"artist":"Coldplay","title":"Music Of The Spheres","label":"Parlophone","year_pressed":2021,"genre":"Pop","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Album"},{"id":183,"artist":"The Beatles","title":"Rock 'N' Roll Music","label":"Parlophone","year_pressed":1976,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":184,"artist":"Tina Turner","title":"Queen Of Rock 'N' Roll","label":"Parlophone","year_pressed":2023,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":185,"artist":"David Bowie","title":"ChangesOneBowie","label":"Parlophone","year_pressed":2016,"genre":"EN VENTA","condition":"Near Mint (NM or M-)","for_sale":true,"format":"LP, Comp, RE"},{"id":186,"artist":"Chubby Checker","title":"Still Twistin'","label":"Peerless","year_pressed":1989,"genre":"Rock & Roll","condition":"Very Good (VG)","for_sale":false,"format":"LP"},{"id":187,"artist":"Player","title":"Player","label":"Philips","year_pressed":1977,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":188,"artist":"Pink Floyd","title":"A Foot In The Door (The Best Of Pink Floyd)","label":"Pink Floyd Records","year_pressed":2018,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RM"},{"id":189,"artist":"Pointer Sisters","title":"So Excited!","label":"Planet","year_pressed":1982,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":190,"artist":"ABBA","title":"Gold (Greatest Hits)","label":"Polar","year_pressed":2022,"genre":"Pop","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, Pic, RE"},{"id":191,"artist":"Rainbow","title":"Down To Earth","label":"Polydor","year_pressed":null,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album, RP"},{"id":192,"artist":"The Allman Brothers Band","title":"The Allman Brothers Band At Fillmore East","label":"Polydor","year_pressed":null,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Album, RE"},{"id":193,"artist":"The Police","title":"Greatest Hits","label":"Polydor","year_pressed":2022,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":194,"artist":"Bananarama","title":"The Greatest Hits Collection","label":"PolyGram","year_pressed":1989,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":195,"artist":"Cyndi Lauper","title":"She's So Unusual","label":"Portrait","year_pressed":1983,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":196,"artist":"The Kinks","title":"The Best Of The Kinks","label":"Pye Records","year_pressed":1977,"genre":"Rock & Roll","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":197,"artist":"Rick Springfield","title":"Rick Springfield's Greatest Hits","label":"RCA","year_pressed":1989,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":198,"artist":"Sam Cooke","title":"The Best Of Sam Cooke","label":"RCA","year_pressed":1981,"genre":"Funk/Soul","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp"},{"id":199,"artist":"The Guess Who","title":"The Greatest Of The Guess Who","label":"RCA Victor","year_pressed":1977,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":200,"artist":"Elvis Presley","title":"The Wonder Of You","label":"RCA","year_pressed":2016,"genre":"Rock & Roll","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Album"},{"id":201,"artist":"Elvis Presley","title":"ELV1S 30 #1 Hits","label":"RCA","year_pressed":2015,"genre":"Rock & Roll","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":202,"artist":"Daryl Hall & John Oates","title":"Their Ultimate Collection","label":"RCA","year_pressed":2022,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp"},{"id":203,"artist":"My Chemical Romance","title":"May Death Never Stop You","label":"Reprise Records","year_pressed":2024,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":204,"artist":"Green Day","title":"Greatest Hits: God's Favorite Band","label":"Reprise Records","year_pressed":2017,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":205,"artist":"The B-52's","title":"Cosmic Thing","label":"Reprise Records","year_pressed":1989,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":206,"artist":"Chicago","title":"Greatest Hits 1982-1989","label":"Reprise Records","year_pressed":1989,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":207,"artist":"Foreigner","title":"40","label":"Rhino Records","year_pressed":2017,"genre":"Classic Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":208,"artist":"Elton John","title":"Diamonds","label":"Rocket Entertainment","year_pressed":null,"genre":"Pop Rock","condition":"Mint (M)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":209,"artist":"The Rolling Stones","title":"Rewind (1971-1984)","label":"Rolling Stones Records","year_pressed":1984,"genre":"Classic Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":210,"artist":"Foo Fighters","title":"Greatest Hits","label":"Roswell Records","year_pressed":2009,"genre":"Punk Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":211,"artist":"Derek & The Dominos","title":"Layla And Other Assorted Love Songs","label":"RSO","year_pressed":null,"genre":"Blues","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Album"},{"id":212,"artist":"The Bill Evans Trio","title":"Portrait In Jazz","label":"Second Records","year_pressed":2022,"genre":"Jazz","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":213,"artist":"The Pretenders","title":"The Singles","label":"Sire","year_pressed":1987,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":214,"artist":"Madonna","title":"The Immaculate Collection","label":"Sire","year_pressed":2018,"genre":"Pop","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp, RE"},{"id":215,"artist":"Poison","title":"Look What The Cat Dragged In","label":"Sonografica","year_pressed":1987,"genre":"Hard Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":216,"artist":"La 5a Estacion","title":"Flores De Alquiler","label":"Sony Music","year_pressed":2023,"genre":"Latin","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Album"},{"id":217,"artist":"The Script","title":"Tales From The Script: Greatest Hits","label":"Sony Music","year_pressed":2022,"genre":"Pop","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":218,"artist":"Albert King With Stevie Ray Vaughan","title":"In Session","label":"Stax","year_pressed":2010,"genre":"Blues","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":219,"artist":"Jerry Lee Lewis","title":"Original Golden Hits - Volume 1","label":"Sun","year_pressed":1972,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Comp, RE"},{"id":220,"artist":"Stevie Wonder","title":"Stevie Wonder's Original Musiquarium I","label":"Tamla","year_pressed":1982,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":221,"artist":"Kiss","title":"Kissworld (The Best Of Kiss)","label":"UMe","year_pressed":2019,"genre":"Hard Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"2xLP, Comp"},{"id":222,"artist":"Jay & The Americans","title":"The Very Best Of Jay & The Americans","label":"United Artists Records","year_pressed":1975,"genre":"Soft Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Comp, Mono"},{"id":223,"artist":"The Vapors","title":"Turning Japanese","label":"United Artists Records","year_pressed":1980,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"7\", Shape"},{"id":224,"artist":"Dire Straits","title":"Money For Nothing","label":"Vertigo","year_pressed":1988,"genre":"Classic Rock","condition":"Good Plus (G+)","for_sale":false,"format":"LP, Comp"},{"id":225,"artist":"Little Richard","title":"Greatest Hits","label":"Vinyl Passion","year_pressed":2012,"genre":"Rock & Roll","condition":"Mint (M)","for_sale":false,"format":"LP, Comp, RM"},{"id":226,"artist":"The Human League","title":"Atrevete!","label":"Virgin","year_pressed":1982,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":227,"artist":"Cutting Crew","title":"Broadcast","label":"Virgin","year_pressed":1987,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":228,"artist":"Phil Collins","title":"No Jacket Required","label":"Virgin","year_pressed":1985,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":229,"artist":"Culture Club","title":"Colour By Numbers","label":"Virgin","year_pressed":1983,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":230,"artist":"George Benson","title":"The George Benson Collection","label":"Warner Bros. Records","year_pressed":1981,"genre":"Funk/Soul","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Comp"},{"id":231,"artist":"Fleetwood Mac","title":"Rumours","label":"Warner Bros. Records","year_pressed":1977,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":232,"artist":"America","title":"History - America's Greatest Hits","label":"Warner Bros. Records","year_pressed":null,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp, RE"},{"id":233,"artist":"Ambrosia","title":"Life Beyond L.A.","label":"Warner Bros. Records","year_pressed":1978,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":234,"artist":"Ambrosia","title":"One Eighty","label":"Warner Bros. Records","year_pressed":1980,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":235,"artist":"The Doobie Brothers","title":"Best Of The Doobies Volume II","label":"Warner Bros. Records","year_pressed":1981,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":236,"artist":"Rod Stewart","title":"The Best Of Rod Stewart","label":"Warner Bros. Records","year_pressed":1989,"genre":"Soft Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":237,"artist":"Nelson","title":"After the rain","label":"Warner Bros. Records","year_pressed":1990,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":238,"artist":"Rod Stewart","title":"Tonight I'm Yours","label":"Warner Bros. Records","year_pressed":1981,"genre":"EN VENTA","condition":"Very Good (VG)","for_sale":true,"format":"LP, Album"},{"id":239,"artist":"John Fogerty","title":"Centerfield","label":"Warner Bros. Records","year_pressed":1985,"genre":"Classic Rock","condition":"Very Good (VG)","for_sale":false,"format":"LP, Album"},{"id":240,"artist":"Fleetwood Mac","title":"Tango In The Night","label":"Warner Bros. Records","year_pressed":1987,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":241,"artist":"Rod Stewart","title":"Camouflage","label":"Warner Bros. Records","year_pressed":1984,"genre":"Pop Rock","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":242,"artist":"Frankie Valli, The Four Seasons","title":"Reunited Live","label":"Warner Bros. Records","year_pressed":1981,"genre":"Pop","condition":"Very Good Plus (VG+)","for_sale":false,"format":"2xLP, Album"},{"id":243,"artist":"The Association","title":"Greatest Hits!","label":"Warner Bros. Records","year_pressed":1970,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Comp, RP"},{"id":244,"artist":"a-ha","title":"Headlines And Deadlines - The Hits Of A-Ha","label":"Warner Bros. Records","year_pressed":2018,"genre":"Pop","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":245,"artist":"Rod Stewart","title":"Blondes Have More Fun","label":"Warner Bros. Records","year_pressed":1978,"genre":"EN VENTA","condition":"Very Good Plus (VG+)","for_sale":true,"format":"LP, Album"},{"id":246,"artist":"Johnny Lee","title":"Greatest Hits","label":"Warner Bros. Records","year_pressed":1983,"genre":"Country","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Comp"},{"id":247,"artist":"Luis Miguel","title":"Aries","label":"Warner Recorded Music","year_pressed":2023,"genre":"Latin","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, RE"},{"id":248,"artist":"Linkin Park","title":"Papercuts","label":"Warner Records","year_pressed":2024,"genre":"Hard Rock","condition":"Mint (M)","for_sale":false,"format":"2xLP, Comp"},{"id":249,"artist":"Fleetwood Mac","title":"Greatest Hits","label":"Warner Records","year_pressed":null,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":250,"artist":"The Doobie Brothers","title":"Best Of The Doobies","label":"Warner Records","year_pressed":2020,"genre":"Pop Rock","condition":"Near Mint (NM or M-)","for_sale":false,"format":"LP, Comp, RE"},{"id":251,"artist":"Chuck Berry","title":"Very Good!! 20 Greatest Rock & Roll Hits","label":"WaxTime","year_pressed":2019,"genre":"Rock & Roll","condition":"Mint (M)","for_sale":false,"format":"LP, Comp"},{"id":252,"artist":"Miguel Bose","title":"XXX","label":"WEA","year_pressed":1988,"genre":"Latin","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":253,"artist":"Luis Miguel","title":"Busca Una Mujer","label":"WEA","year_pressed":1988,"genre":"Latin","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP"},{"id":254,"artist":"Luis Miguel","title":"20 Anos","label":"WEA","year_pressed":1990,"genre":"Latin","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP, Album"},{"id":255,"artist":"Miguel Bose","title":"Los Chicos No Lloran","label":"WEA","year_pressed":1990,"genre":"Latin","condition":"Very Good Plus (VG+)","for_sale":false,"format":"LP"}];

const STORAGE_KEY = "vinyl-crate-v3";

const GENRE_STYLES = {
  "Classic Rock":    "bg-orange-900/40 text-orange-300 border-orange-800/40",
  "Hard Rock":       "bg-red-900/40 text-red-300 border-red-800/40",
  "Pop Rock":        "bg-sky-900/40 text-sky-300 border-sky-800/40",
  "Soft Rock":       "bg-teal-900/40 text-teal-300 border-teal-800/40",
  "Rock & Roll":     "bg-yellow-900/40 text-yellow-300 border-yellow-800/40",
  "Funk/Soul":       "bg-purple-900/40 text-purple-300 border-purple-800/40",
  "Jazz":            "bg-indigo-900/40 text-indigo-300 border-indigo-800/40",
  "Latin":           "bg-rose-900/40 text-rose-300 border-rose-800/40",
  "Punk Rock":       "bg-lime-900/40 text-lime-300 border-lime-800/40",
  "Electronic":      "bg-cyan-900/40 text-cyan-300 border-cyan-800/40",
  "Blues":           "bg-blue-900/40 text-blue-300 border-blue-800/40",
  "Pop":             "bg-pink-900/40 text-pink-300 border-pink-800/40",
  "Rock en Espanol": "bg-amber-900/40 text-amber-300 border-amber-800/40",
  "Country":         "bg-green-900/40 text-green-300 border-green-800/40",
  "Reggae":          "bg-emerald-900/40 text-emerald-300 border-emerald-800/40",
  "Classical":       "bg-violet-900/40 text-violet-300 border-violet-800/40",
};

const DISC_GRADIENT_PAIRS = [
  ["#1f0a0a","#3a0d0d"],["#0a0a1f","#0d0d3a"],["#0a1f0a","#0d3a0d"],
  ["#1f1a0a","#3a300d"],["#0a1a1f","#0d2a3a"],["#1a0a1f","#2a0d3a"],
  ["#1f0f0a","#3a1a0d"],["#0f0a1f","#1a0d3a"],
];

function discGrad(id) { return DISC_GRADIENT_PAIRS[id % DISC_GRADIENT_PAIRS.length]; }

function VinylDisc({ record, size = 64 }) {
  const [c1, c2] = discGrad(record.id);
  const labelSize = size * 0.30;
  const labelColor = record.genre?.includes("Jazz") ? "#152840" :
    record.genre?.includes("Blues") ? "#121240" :
    record.genre?.includes("Funk") ? "#2a0a2a" :
    record.genre?.includes("Latin") ? "#2a0808" :
    record.genre?.includes("Electronic") ? "#081a24" :
    record.genre?.includes("Punk") ? "#0a1a0a" :
    (record.year_original||record.year_pressed||1975) < 1965 ? "#241a08" :
    (record.year_original||record.year_pressed||1975) < 1975 ? "#2a1008" :
    (record.year_original||record.year_pressed||1975) < 1985 ? "#08141a" :
    "#14081a";
  return (
    <div className="rounded-full flex-shrink-0 relative flex items-center justify-center"
      style={{ width: size, height: size, background: `radial-gradient(circle at 38% 38%, ${c1}, ${c2})`,
               boxShadow: "0 3px 16px rgba(0,0,0,0.65)" }}>
      {[0.88,0.70,0.52,0.36].map((s,i) => (
        <div key={i} className="absolute rounded-full border border-white/[0.035]"
          style={{ width: `${s*100}%`, height: `${s*100}%` }} />
      ))}
      <div className="rounded-full z-10 flex items-center justify-center"
        style={{ width: labelSize, height: labelSize, background: labelColor, boxShadow: "inset 0 0 4px rgba(255,255,255,0.04)" }}>
        {[0.78,0.54,0.30].map((s,i) => (
          <div key={i} className="absolute rounded-full border border-white/[0.06]"
            style={{ width: `${labelSize*s}px`, height: `${labelSize*s}px` }} />
        ))}
        <div className="rounded-full bg-black/50" style={{ width: labelSize*0.18, height: labelSize*0.18 }} />
      </div>
    </div>
  );
}

function GenreTag({ genre }) {
  const cls = GENRE_STYLES[genre] || "bg-stone-800/40 text-stone-400 border-stone-700/40";
  return <span className={`text-xs px-1.5 py-0.5 rounded-full border ${cls} whitespace-nowrap`}>{genre}</span>;
}

function condenseCondition(c) {
  return (c||"")
    .replace("Near Mint (NM or M-)","NM")
    .replace("Very Good Plus (VG+)","VG+")
    .replace("Very Good (VG)","VG")
    .replace("Mint (M)","M")
    .replace("Good Plus (G+)","G+")
    .replace("Good (G)","G");
}

function RecordRow({ record, onClick }) {
  const year = record.year_original || record.year_pressed;
  return (
    <div onClick={() => onClick(record)}
      className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.04] active:scale-[0.99] border border-transparent hover:border-white/[0.07]">
      <VinylDisc record={record} size={52} />
      <div className="flex-1 min-w-0">
        <div className="truncate text-amber-50 leading-snug" style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17 }}>
          {record.title}
        </div>
        <div className="text-stone-400 text-xs truncate mt-0.5">{record.artist}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 ml-1">
        {year ? <span className="text-stone-600 text-xs">{year}</span> : null}
        <GenreTag genre={record.genre} />
      </div>
    </div>
  );
}

function DetailSheet({ record, onClose, onSeedNext }) {
  const year = record.year_original || record.year_pressed;
  const isRepress = record.year_original && record.year_pressed && record.year_original !== record.year_pressed;
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center" onClick={onClose}>
      <div className="bg-stone-950 border border-stone-800/80 rounded-t-3xl w-full max-w-md p-5 pb-8" onClick={e=>e.stopPropagation()}>
        <div className="w-8 h-1 bg-white/15 rounded-full mx-auto mb-4" />
        <div className="flex gap-4 items-start mb-4">
          <VinylDisc record={record} size={84} />
          <div className="flex-1 pt-0.5">
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:22 }} className="text-amber-50 font-semibold leading-tight mb-1">
              {record.title}
            </div>
            <div className="text-stone-300 text-sm mb-2">{record.artist}</div>
            <div className="flex flex-wrap gap-1.5">
              <GenreTag genre={record.genre} />
              {record.is_compilation && <span className="text-xs px-1.5 py-0.5 rounded-full border border-stone-700/50 text-stone-500">Compilation</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          {[["Year", year||"—"],["Condition",condenseCondition(record.condition)||"—"],["Label",(record.label||"—").split(",")[0].trim().slice(0,16)]].map(([k,v])=>(
            <div key={k} className="bg-white/[0.04] rounded-xl p-2.5">
              <div className="text-stone-600 text-xs mb-0.5">{k}</div>
              <div className="text-stone-200 text-sm font-medium truncate">{v}</div>
            </div>
          ))}
        </div>
        {isRepress && <div className="text-stone-600 text-xs text-center mb-3">Originally {record.year_original} · This press {record.year_pressed}</div>}
        <div className="text-stone-600 text-xs text-center mb-4">{record.format}</div>
        <button onClick={()=>{ onSeedNext(record); onClose(); }}
          className="w-full py-3 rounded-xl bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm font-medium hover:bg-amber-900/50 transition-colors">
          ▶︎ Seed "Play Next" from this record
        </button>
      </div>
    </div>
  );
}

function RecoCard({ reco, onClose }) {
  if (!reco) return null;
  const { record, reason, label } = reco;
  return (
    <div className="rounded-2xl border border-stone-700/60 bg-stone-900/80 p-5 relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">{label}</span>
        <button onClick={onClose} className="text-stone-600 hover:text-stone-300 text-xl leading-none">×</button>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <VinylDisc record={record} size={70} />
        <div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:21 }} className="text-amber-50 font-semibold leading-tight">
            {record.title}
          </div>
          <div className="text-stone-400 text-sm">{record.artist}</div>
          <div className="flex items-center gap-2 mt-1">
            {(record.year_original||record.year_pressed) && <span className="text-stone-500 text-xs">{record.year_original||record.year_pressed}</span>}
            <GenreTag genre={record.genre} />
          </div>
        </div>
      </div>
      {reason && <div className="border-t border-white/[0.06] pt-3 text-stone-300 text-sm leading-relaxed italic">{reason}</div>}
    </div>
  );
}

// ─── KEY CHANGE: calls our own Next.js API route instead of Anthropic directly ───
async function callClaude(messages, maxTokens = 400) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: maxTokens }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.content?.[0]?.text || "";
}

async function enrichBatch(batch) {
  const lines = batch.map(r => `${r.id}. "${r.title}" by ${r.artist} (Discogs year: ${r.year_pressed||"?"}, format: ${r.format})`).join("\n");
  const text = await callClaude([{ role:"user", content:`For each record give the ORIGINAL first release year and whether it's a compilation/greatest hits. Return ONLY a JSON array: [{"id":1,"year_original":1969,"is_compilation":false},...]. No markdown.\n\nRecords:\n${lines}` }], 1800);
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

export default function VinylCrate() {
  const [collection, setCollection] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [tab, setTab] = useState("crate");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("artist");
  const [showForSale, setShowForSale] = useState(false);
  const [selected, setSelected] = useState(null);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [reco, setReco] = useState(null);
  const [recoLoading, setRecoLoading] = useState(false);
  const [recoError, setRecoError] = useState("");
  const [mood, setMood] = useState("");

  useEffect(() => {
    const cached = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();
    if (cached?.length === RAW_COLLECTION.length) { setCollection(cached); return; }
    (async () => {
      const BATCH = 28;
      const batches = [];
      for (let i = 0; i < RAW_COLLECTION.length; i += BATCH) batches.push(RAW_COLLECTION.slice(i, i + BATCH));
      setProgress({ done: 0, total: RAW_COLLECTION.length });
      const map = {};
      for (const batch of batches) {
        try {
          const res = await enrichBatch(batch);
          res.forEach(r => { map[r.id] = r; });
        } catch {
          batch.forEach(r => { map[r.id] = { id: r.id, year_original: r.year_pressed, is_compilation: false }; });
        }
        setProgress(p => ({ ...p, done: Math.min(p.done + batch.length, RAW_COLLECTION.length) }));
        await new Promise(r => setTimeout(r, 200));
      }
      const enriched = RAW_COLLECTION.map(r => ({
        ...r,
        year_original: map[r.id]?.year_original || r.year_pressed || null,
        is_compilation: map[r.id]?.is_compilation ?? false,
      }));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched)); } catch {}
      setCollection(enriched);
    })();
  }, []);

  const myRecords = collection ? collection.filter(r => !r.for_sale) : [];
  const forSaleRecords = collection ? collection.filter(r => r.for_sale) : [];
  const pool = showForSale ? forSaleRecords : myRecords;

  const sorted = [...pool].sort((a, b) => {
    if (sortBy === "year") return (a.year_original || 9999) - (b.year_original || 9999);
    if (sortBy === "genre") return (a.genre || "").localeCompare(b.genre || "");
    return a.artist.localeCompare(b.artist);
  });

  const filtered = search
    ? sorted.filter(r => {
        const q = search.toLowerCase();
        return r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q) || (r.genre || "").toLowerCase().includes(q);
      })
    : sorted;

  const getReco = useCallback(async (type) => {
    setRecoLoading(true); setRecoError(""); setReco(null);
    try {
      const list = myRecords.map(r =>
        `id:${r.id}|"${r.title}"|${r.artist}|${r.year_original||r.year_pressed||"?"}|${r.genre}${r.is_compilation?" (comp)":""}`
      ).join("\n");
      const today = new Date();
      const month = today.toLocaleString("default", { month:"long" });
      const day = today.getDate();
      let ctx = "";
      if (type === "random") ctx = "Pick one completely random record. Surprise me.";
      else if (type === "daily") ctx = `Today is ${month} ${day}. Pick the most fitting record for this specific date — consider season in Mexico, holidays (e.g. July 4 = American vibes, Dec = festive, Dia de Muertos, etc.), time-of-year energy. Be creative and specific.`;
      else if (type === "mood") ctx = `Pick the single best record for this mood: "${mood}"`;
      else ctx = `I just listened to "${lastPlayed?.title}" by ${lastPlayed?.artist} (${lastPlayed?.year_original||lastPlayed?.year_pressed}, ${lastPlayed?.genre}). Pick the ideal next record.`;
      const text = await callClaude([{ role:"user", content:`Vinyl curator. ${ctx}\n\nCollection:\n${list}\n\nRespond ONLY with JSON: {"id":<number>,"reason":"<one vivid specific sentence>"}\nNo markdown.` }], 300);
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      const found = myRecords.find(r => r.id === parsed.id);
      if (!found) throw new Error();
      setReco({ record: found, reason: parsed.reason, label: {random:"Random Pick",daily:"Today's Pick",mood:"Mood Match",next:"Play Next"}[type] });
    } catch { setRecoError("Couldn't get a recommendation — try again."); }
    finally { setRecoLoading(false); }
  }, [myRecords, mood, lastPlayed]);

  if (!collection) {
    const pct = progress.total ? Math.round(progress.done / progress.total * 100) : 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-8 text-center"
        style={{ background:"linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)", fontFamily:"'DM Sans',sans-serif" }}>
        <div className="text-4xl mb-5" style={{ animation:"spin 3s linear infinite" }}>⏺</div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24 }} className="text-amber-100 mb-2">
          Digging through the crate...
        </div>
        <div className="text-stone-500 text-sm mb-5">Looking up original release years for {RAW_COLLECTION.length} records</div>
        <div className="w-56 h-1.5 bg-stone-800 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-amber-800 rounded-full transition-all duration-500" style={{ width:`${pct}%`}}/>
        </div>
        <div className="text-stone-600 text-xs">{progress.done} / {progress.total}</div>
        <div className="text-stone-700 text-xs mt-8 max-w-xs leading-relaxed">One-time setup — saved locally so this never runs again</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto"
      style={{ background:"linear-gradient(160deg,#1c1610 0%,#0c0b09 100%)", fontFamily:"'DM Sans',sans-serif", color:"#e8ddd0" }}>

      {/* Header */}
      <div className="px-5 pt-7 pb-2">
        <div className="text-xs uppercase tracking-widest text-amber-900 mb-0.5">Juan&apos;s</div>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:30, lineHeight:1 }} className="text-amber-50">
          Vinyl Crate
        </h1>
        <div className="text-stone-600 text-xs mt-1">{myRecords.length} records · {forSaleRecords.length} en venta</div>
      </div>

      {/* Tabs */}
      <div className="flex px-4 gap-1 mt-3 mb-2">
        {[["crate","⏺ Crate"],["reco","✦ Reco"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab===id?"bg-amber-900/25 text-amber-400 border border-amber-800/35":"text-stone-500 hover:text-stone-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "crate" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 space-y-2 mb-1">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search artist, title, genre..."
              className="w-full bg-stone-900/70 border border-stone-800/80 rounded-xl px-4 py-2.5 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/60"/>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[["artist","A–Z"],["year","Year"],["genre","Genre"]].map(([k,l])=>(
                  <button key={k} onClick={()=>setSortBy(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-all ${sortBy===k?"bg-stone-700 text-amber-300":"text-stone-600 hover:text-stone-300"}`}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex-1"/>
              <button onClick={()=>setShowForSale(s=>!s)}
                className={`px-3 py-1 rounded-lg text-xs border transition-all ${showForSale?"bg-rose-900/25 border-rose-800/40 text-rose-300":"border-stone-800 text-stone-600 hover:text-stone-400"}`}>
                {showForSale ? "📋 En Venta" : "En Venta"}
              </button>
            </div>
            <div className="text-xs text-stone-700">{filtered.length} records</div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-8 space-y-0.5">
            {filtered.map(r => (
              <RecordRow key={r.id} record={r} onClick={rec=>{ setSelected(rec); if(!rec.for_sale) setLastPlayed(rec); }}/>
            ))}
            {filtered.length === 0 && <div className="text-center text-stone-700 py-16">No records found</div>}
          </div>
        </div>
      )}

      {tab === "reco" && (
        <div className="flex-1 px-4 overflow-y-auto pb-8 space-y-3">
          {[
            {type:"random", icon:"🎲", title:"Random Pick", sub:"Surprise me from the crate"},
            {type:"daily",  icon:"📅", title:"Today's Pick", sub:`Seasonal & cultural fit for ${new Date().toLocaleString("default",{month:"long",day:"numeric"})}`},
            {type:"next",   icon:"▶︎",  title:"Play Next", sub: lastPlayed ? `After "${(lastPlayed.title||"").slice(0,30)}${lastPlayed.title?.length>30?"...":""}"` : "Tap a record in Crate first", disabled:!lastPlayed},
          ].map(({type,icon,title,sub,disabled})=>(
            <button key={type} onClick={()=>!disabled && !recoLoading && getReco(type)} disabled={!!disabled||recoLoading}
              className={`w-full py-3.5 rounded-xl border text-left px-4 flex items-center gap-3 transition-all
                ${disabled?"border-stone-800/50 opacity-35":"border-stone-700/60 hover:border-amber-900/50 hover:bg-white/[0.02]"}`}>
              <span className="text-xl w-8 text-center">{icon}</span>
              <div>
                <div className="font-medium text-stone-200 text-sm">{title}</div>
                <div className="text-xs text-stone-600">{sub}</div>
              </div>
            </button>
          ))}

          <div className="rounded-xl border border-stone-700/60 p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xl w-8 text-center">🌙</span>
              <div>
                <div className="font-medium text-stone-200 text-sm">Mood Match</div>
                <div className="text-xs text-stone-600">Describe how you&apos;re feeling or what you need</div>
              </div>
            </div>
            <input value={mood} onChange={e=>setMood(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&mood&&!recoLoading&&getReco("mood")}
              placeholder="e.g. melancholic rainy night, want to dance, road trip energy..."
              className="w-full bg-stone-900/70 border border-stone-800 rounded-lg px-3 py-2 text-sm text-amber-50 placeholder-stone-700 focus:outline-none focus:border-amber-900/50 mb-3"/>
            <button onClick={()=>mood&&!recoLoading&&getReco("mood")} disabled={!mood||recoLoading}
              className="w-full py-2.5 rounded-lg bg-amber-900/30 border border-amber-800/40 text-amber-300 text-sm font-medium disabled:opacity-40 hover:bg-amber-900/50 transition-colors">
              Find a Match
            </button>
          </div>

          {recoLoading && (
            <div className="text-center py-8">
              <div className="text-amber-900 text-3xl" style={{ display:"inline-block", animation:"spin 2s linear infinite" }}>⏺</div>
              <div className="text-stone-600 text-sm mt-3">Flipping through the crate...</div>
            </div>
          )}
          {recoError && <div className="text-red-500/70 text-sm text-center py-3">{recoError}</div>}
          {reco && !recoLoading && <RecoCard reco={reco} onClose={()=>setReco(null)}/>}
        </div>
      )}

      {selected && (
        <DetailSheet record={selected} onClose={()=>setSelected(null)}
          onSeedNext={rec=>{ setLastPlayed(rec); setTab("reco"); setSelected(null); }}/>
      )}
    </div>
  );
}
