# Schulazon

Schulazon ist eine webbasierte Lernumgebung zum Üben von SQL-Abfragen in einem simulierten Onlineshop.

Das Projekt wurde im Rahmen einer Zulassungsarbeit am Lehrstuhl für Didaktik der Informatik an der LMU München entwickelt.

## Start

Primärer Zugang über GitHub Pages:

```text
https://jakobzebhauser.github.io/schoolazon/
```

Alternativ kann die Anwendung lokal über einen kleinen Webserver geöffnet werden.

```bash
python -m http.server
```

Danach im Browser öffnen:

```text
http://localhost:8000/index.html
```


## Hinweise

Die Anwendung läuft vollständig clientseitig im Browser. SQL-Abfragen werden mit `sql.js` gegen eine lokale SQLite-Datenbank ausgeführt.

## Autor

Jakob Zebhauser
