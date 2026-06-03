# Schulazon

**Schulazon** ist ein interaktives SQL-Lernspiel für den Informatikunterricht der 10. Jahrgangsstufe.

Die Lernenden bearbeiten SQL-Aufgaben in einer simulierten Onlineshop-Umgebung. Richtige Abfragen schalten Funktionen und Buttons frei und machen sichtbar, wie SQL in einer datenbankgestützten Anwendung eingesetzt wird.

## Direkt starten

Die aktuelle Version ist über GitHub Pages verfügbar:

```text
https://jakobzebhauser.github.io/schoolazon/
```

Eine Installation ist nicht erforderlich. Die Anwendung läuft direkt im Browser.

## Zielgruppe

Schulazon richtet sich an den Informatikunterricht der 10. Jahrgangsstufe.

Geeignet für:

- Wiederholungsstunde zu SQL
- Übung von SQL-Abfragen
- Einzelarbeit
- Partnerarbeit

## Inhalte

- SELECT
- WHERE
- Sortierung mit ORDER BY
- Suche mit LIKE
- Tabellenverknüpfungen
- Aggregatfunktionen
- Gruppierung mit GROUP BY
- einfache Sicherheitsaspekte wie SQL-Injection

## Technische Umsetzung

Schulazon ist eine vollständig clientseitige Webanwendung.

SQL-Abfragen werden mit `sql.js` direkt im Browser gegen eine lokale SQLite-Datenbank ausgeführt. Dadurch sind echte SQL-Abfragen möglich, ohne dass ein Server benötigt wird.

## Datenschutz

Die Anwendung benötigt keine Anmeldung.

Fortschritte und Spielstände werden lokal im Browser gespeichert. Es findet keine serverseitige Speicherung personenbezogener Daten statt.

## Lokal ausführen

Alternativ kann Schulazon lokal über einen einfachen Webserver gestartet werden.

Repository klonen oder herunterladen und im Projektordner ausführen:

```bash
python -m http.server
```

Danach im Browser öffnen:

```text
http://localhost:8000/index.html
```

## Projektkontext

Das Projekt wurde im Rahmen einer Zulassungsarbeit am Lehrstuhl für Didaktik der Informatik an der LMU München entwickelt.

## Autor

Jakob Zebhauser