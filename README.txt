PROJECT KINGDOM — PROTOTYPE 0.1

Bestanden:
- index.html: schermstructuur
- style.css: vormgeving en illustratieve grondstofvelden
- game.js: spelregels, economie, bouwtijden en opslag
- manifest.webmanifest: basis voor iPhone-beginscherm

Spelen op pc: open index.html met Chrome, Firefox of Edge.
Spelen op iPhone: publiceer de vier bestanden op gratis statische hosting zoals GitHub Pages. Open de HTTPS-link vervolgens in Safari, en gebruik eventueel 'Zet op beginscherm'. Er is geen eigen domein vereist.

Spelregels:
- Start: 200 per grondstof, basisproductie 25/u per grondstofsoort.
- 10 velden: 2 hout, 2 klei, 2 erts, 4 graan.
- Upgrade veld: prijs start volgens onze tabel, elk niveau ×1,3.
- Extra veldproductie: niveau 1 +10/u, 2 +15/u ... 10 +405/u.
- Eén gelijktijdige bouwopdracht. Proefbouwtijden beginnen bij 20 seconden.
- Startgebouwen: hoofdgebouw, pakhuis, graanschuur op niveau 1.
- Startopslag: 800 per grondstof. Opslaggroei bij bereiken niveau 2-4 ×1,2; niveau 5-9 ×1,3; niveau 10+ ×1,5.
- Automatische opslag in localStorage op hetzelfde apparaat/dezelfde browser.

Nog niet geïmplementeerd: verkenners, NPC's, militaire gevechten, definitieve gebouwbalans, aparte afbeeldingen en realtime synchronisatie tussen apparaten.
LET OP: browsergegevens wissen verwijdert mogelijk de spelstand.


VERSIE 0.2 — HEXAGONEN
De 10 bestaande grondstofvelden zijn nu als 2D-geillustreerde hexagons zichtbaar,
met een elfde dorpshexagon in het midden. De illustraties staan in assets/.
Tik op de afbeeldingen voor upgrades; de dorpshexagon opent de dorpskern.
Alle bestaande spelstanden blijven behouden doordat de save-key niet is gewijzigd.
Upload de vijf bestanden en de gehele assets-map naar dezelfde hoofdmap op GitHub.
LET OP: browseropslag is lokaal per apparaat/browser. Maak een backup indien nodig.
