# Servicio 378 – Calculadora de tiempos de servicio

App web liviana para chequear rápido si un servicio de vuelo está dentro del
**Decreto 378/2025** (Anexo I, reglamentación del Título V de la Ley 17.285),
para transporte aéreo regular. Funciona **sin conexión** y se instala en el
iPhone como acceso directo.

## Qué calcula

Con la **hora de presentación** y la **hora del último arribo (calzos)**:

- **Tiempo de servicio de vuelo** contra el máximo:
  - pilotos con tripulación mínima: Art. 10 (hora de inicio × segmentos);
  - pilotos con 3 o 4 pilotos: Art. 11 (clase de descanso a bordo);
  - tripulantes de cabina: Art. 18 (14, 16 o 18 h).
- **Hora límite de arribo**, normal y con la excepción del +20 % (Art. 24).
- **Estado:** dentro del decreto, solo con excepción, o fuera del decreto.
- **Descanso mínimo** y hora más temprana para la próxima presentación:
  - pilotos: Arts. 13 y 15;
  - tripulantes de cabina: Art. 19.
- Opcionales:
  - tiempo de vuelo (Arts. 9 y 12);
  - horas del mes y del año (Art. 8, +10 % mensual por excepción);
  - tripulación mínima de cabina según asientos.

Las reglas están en `js/rules.js` y tienen tests en `tests/`.

### Criterios adoptados donde el decreto es ambiguo

- Las tablas se leen con la **hora local donde el tripulante está aclimatado**.
- Si el arribo es anterior a la presentación, se toma como el **día siguiente**.
- El +20 % del Art. 24 se aplica sobre el máximo de servicio y sobre el de vuelo.
- Extensión del Art. 12 con 4 pilotos (19 h de vuelo): solo con descanso clase 1.
- Descanso desde calzas puestas (o fin del traslado del Art. 13): 10 h por
  decreto y 12 h por la compañía (resolución de la compañía, no del decreto).
  Próxima presentación = fin de servicio + 12 h.

## Instalar en el iPhone

1. Abrí la URL publicada en **Safari**.
2. Tocá **Compartir → Agregar a pantalla de inicio**.
3. Abrila una vez con conexión. Después funciona offline.

## Publicar (GitHub Pages)

El workflow `.github/workflows/pages.yml` corre los tests y publica cada push a `main`.

1. En el repo, entrá a **Settings → Pages → Build and deployment** y elegí
   **Source: GitHub Actions**.
2. GitHub Pages en repos **privados** requiere un plan pago. Si no lo tenés,
   hacé el repo público: no contiene datos sensibles.
3. La app queda en `https://<usuario>.github.io/air-services-calculator/`.

Cuando cambies archivos, subí `VERSION` en `sw.js` para que los teléfonos
descarguen la versión nueva.

## Desarrollo

```bash
npm test     # tests de las reglas (Node 18+)
npm start    # servidor local en http://localhost:8080
```

> Herramienta de referencia. No reemplaza al decreto ni a las normas del explotador.
> Si el explotador tiene un FRMS propio (Art. 6), rigen sus límites.
