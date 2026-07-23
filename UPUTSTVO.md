# PINIT ZAJEDNICA

Komšiluk na jednom mjestu. Napraviš zajednicu za svoj kvart ili selo, komšije se učlane,
i dogovarate utakmice, roštilje, radne akcije ili tražite pomoć kad zatreba.

**Sve je besplatno i neprofitno.** Nema članarine, reklama ni prodaje podataka.

---

## Šta je u paketu

    server.js            server (čisti Node.js, npm install NIJE potreban)
    public/index.html    cijela aplikacija
    public/manifest.json podaci za "dodaj na početni ekran"
    public/sw.js         offline ljuska
    public/icon-*.png    ikone
    render.yaml          podešavanje za Render
    data.json            nastaje sam kad se pokrene

Ovo je **samo Zajednica** — nema više prijava problema, Drive mjerenja, platforme ni
komandnog centra. Jedna aplikacija, jedna svrha.

---

## A) Proba kod kuće

1. Instaliraj Node.js sa nodejs.org
2. U folderu: `node server.js`
3. Otvori `http://localhost:3000`
4. Upiši ime → "Napravi novu zajednicu" → "Postani član"

Za probu s telefona na istoj Wi-Fi mreži, server ispiše i adresu tipa
`http://192.168.x.x:3000`. Napomena: preko običnog http GPS radi samo na localhost —
za telefon koristi online varijantu (B).

---

## B) Objava na Renderu

1. Cijeli folder na GitHub (**server.js mora biti na vrhu, ne u podfolderu**)
2. render.com → New → Web Service → poveži repo → prepozna `render.yaml` → Deploy
3. Adresa koju daješ komšijama: `https://ime.onrender.com`

### VAŽNO — besplatni plan i podaci
Besplatni servis nema rok trajanja, ali:
- zaspi nakon 15 minuta bez posjeta (prvi ulaz poslije toga traje 30–60 s)
- `data.json` se **briše pri deployu, restartu I spavanju**
- besplatni servis ne može dobiti trajni disk

Znači: za probu s par ljudi je uredu, ali čim krene pravi komšiluk, zajednice bi
nestajale. Tada treba vanjska baza s trajnim besplatnim nivoom (Supabase ili Neon) —
server ostaje isti, mijenja se samo gdje se podaci upisuju.

Ako se pređe na plaćeni servis s diskom: dodaj disk, postavi env `DATA_DIR=/data` i
podaci prežive sve.

---

## Kako se pravi zajednica (3 koraka)

1. **Šta pravimo** — Ulica / Kvart / Naselje / Selo / Opština + naziv
2. **Područje** — namjesti kartu da je oznaka u sredini kvarta, pa klizačem podesi
   dokle seže. Zeleni krug je zona. Centar možeš odrediti i pretragom mjesta
   (npr. "Tešanj") ili dugmetom za GPS.
3. **Ulice** — spisak radi prepoznavanja, da komšija vidi svoju ulicu. Granica ostaje
   krug iz 2. koraka. Može se preskočiti.

**Zašto krug, a ne crtanje granice:** crtanje poligona prstom je mučno i ljudi odustanu.
Krug je jedan potez, a provjera "je li ovaj u zoni" je obično računanje udaljenosti.
Prečnici: ulica 250 m, kvart 800 m, naselje 1.8 km, selo 3 km, opština 8 km.

**Zona nikoga ne izbacuje** — ako si izvan kruga, piše ti koliko si daleko, ali se
svejedno možeš učlaniti. Zona služi samo da ti se prvo prikažu zajednice koje su blizu.

---

## Karte — bez API ključa
MapLibre + OpenStreetMap pločice: besplatno, bez ključa, bez registracije. Ništa se ne
upisuje. Ako se karta ne učita (loš internet), aplikacija **ne puca** — pokaže zamjenski
panel, a sve ostalo radi preko pretrage mjesta i GPS-a.

## Izgled
Nema nijednog emojija — sve su crtane zelene ilustracije (SVG). Svijetla i tamna tema,
prebacuje se u Profilu.

## Zaštita od nereda
- Zajednicu pravi samo prijavljen korisnik
- Ista zajednica ne može se napraviti dva puta u krugu od 1 km
- Objavljivati može samo član te zajednice
- Dešavanje briše autor ili osnivač
- Osnivač ne može istupiti dok ima drugih članova

---

## API

    POST   /api/register                     {name}
    GET    /api/communities?lat=&lng=&token=
    POST   /api/communities                  {token,name,type,lat,lng,radius,streets[],desc}
    GET    /api/communities/:id?token=
    POST   /api/communities/:id/join         {token}
    POST   /api/communities/:id/leave        {token}
    GET    /api/events?cid=&token=
    POST   /api/events                       {token,cid,cat,title,day,time,place,note}
    POST   /api/events/:id/join              {token}
    POST   /api/events/:id/comment           {token,txt}
    DELETE /api/events/:id                   {token}
    GET    /api/geo?q=                       pretraga mjesta (OpenStreetMap)
