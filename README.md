# AgriFlow

AgriFlow is a Spring Boot farm-operations dashboard with H2 persistence and an interactive DSA workbench.

## Run locally

Requirements: JDK 17 or newer and Apache Maven 3.8+.

```bash
mvn spring-boot:run
```

Open [http://localhost:8080](http://localhost:8080). The in-memory H2 database is seeded with demo farms and sensor readings at startup. The H2 console is available at [http://localhost:8080/h2-console](http://localhost:8080/h2-console), using JDBC URL `jdbc:h2:mem:agriflow`, username `sa`, and a blank password.

## Included features

- Farm create, list, update, and delete; dashboard metrics are computed from persisted farm records.
- Sensor observation capture and recent-reading history associated with a farm.
- KMP, Z-function, Rabin–Karp, Aho–Corasick, and suffix-array text search.
- Levenshtein distance, Smith–Waterman local-alignment score, and longest common substring comparison.
- Edmonds–Karp maximum flow with the source side of the resulting minimum cut.
- Reservoir sampling for representative stream samples.
- Responsive browser dashboard served directly by Spring Boot.
- Interactive Three.js farm model with crop parcels, animated irrigation channels, road/building landmarks, moisture-based field colors, and orbit controls.

The 3D field scene loads Three.js from jsDelivr, so an internet connection is needed for the model. If the WebGL module or CDN is unavailable, the field panel falls back to its photo background.

## API examples

```text
GET    /api/dashboard
GET    /api/farms
POST   /api/farms
PUT    /api/farms/{id}
DELETE /api/farms/{id}
GET    /api/sensors
POST   /api/sensors
GET    /api/dsa/search?text=tomato%20blight&query=blight&algorithm=KMP
GET    /api/dsa/compare?left=tomato&right=potato
POST   /api/dsa/water-flow
POST   /api/dsa/reservoir-sample
```

This is a coursework-ready MVP, not a production farm-control system. Sensor ingestion is currently an HTTP capture endpoint; connect a broker/device gateway before using it for real equipment. The DSA roadmap can be extended with SAT/3-SAT reductions, crop-selection bitmask DP, vertex-cover approximation, and parallel scan/reduce demonstrations.