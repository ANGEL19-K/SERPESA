# SST Manager 3.0 — versión preparada para Supabase + Render + Cloudflare R2

Esta versión mantiene la estructura SST del sistema anterior y migra la información recuperada del backup.

## Qué ya dejé preparado

- Diseño responsive para PC, tablet y celular.
- Supabase en lugar de Google Sheets.
- Búsquedas por DNI directamente en la base.
- SST 360° mejorado.
- Alertas automáticas.
- Vencimiento del EMO calculado a 1 año.
- Ventana de alerta de EMO: 30 días.
- EMO con PDF/JPG/PNG/WEBP en Cloudflare R2.
- Historial EMO.
- Visualización segura mediante URL temporal de 5 minutos.
- Exportación de un nuevo backup Excel desde Supabase.
- RLS de Supabase: las tablas exigen usuario autenticado.
- Backend privado para que las claves de R2 nunca estén en el HTML.

## Datos migrados automáticamente

El archivo `supabase/02_seed_datos.sql` incluye:

- Trabajadores preparados: **77**
- Registros EMO recuperados: **46**
- Registros de capacitaciones recuperados: **82**

Las demás hojas del backup estaban sin registros; las tablas sí quedan creadas para empezar a usarlas.

---

# ORDEN EXACTO PARA INSTALAR

## 1. Supabase: crear las tablas

Entra a:

`Supabase > tu proyecto > SQL Editor > New query`

Copia TODO el contenido de:

`supabase/01_schema.sql`

y pulsa **Run**.

Después abre otra consulta y ejecuta:

`supabase/02_seed_datos.sql`

Al final debe devolverte conteos de trabajadores, EMO y capacitaciones.

## 2. Crear el usuario que ingresará al SST Manager

Ve a:

`Supabase > Authentication > Users`

Crea al menos un usuario con correo y contraseña.

La página ya trae pantalla de login.

## 3. Sacar las dos claves públicas de Supabase

Ve a:

`Supabase > Project Settings > API`

Necesitas:

- Project URL
- `anon` / publishable key

Abre:

`frontend/config.js`

y reemplaza:

```js
SUPABASE_URL: "PEGA_AQUI_TU_SUPABASE_URL",
SUPABASE_ANON_KEY: "PEGA_AQUI_TU_SUPABASE_ANON_KEY",
```

La `anon key` puede estar en el frontend porque las tablas tienen RLS.

**NO pongas Service Role en config.js.**

## 4. Crear el backend de R2 en Render

Sube la carpeta completa del proyecto a GitHub.

En Render:

`New > Web Service`

Configura:

- Root Directory: `api`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

En **Environment** crea:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
R2_ENDPOINT
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
ALLOWED_ORIGINS
```

Valores importantes:

```text
R2_BUCKET = sst-manager-documentos
```

`SUPABASE_SERVICE_ROLE_KEY` se obtiene en Supabase y va **solamente en Render**.

Las claves R2 que acabas de crear van **solamente en Render**.

Para el primer deploy puedes dejar `ALLOWED_ORIGINS` sin crear. Cuando tengas la URL final del frontend, créala así:

```text
ALLOWED_ORIGINS=https://tu-sst-manager.onrender.com
```

Cuando el backend quede Live, abre la URL. Debe mostrar:

```json
{"ok":true,"sistema":"SST Manager API","version":"3.0"}
```

Copia esa URL.

## 5. Colocar la URL del backend

Vuelve a:

`frontend/config.js`

y cambia:

```js
API_URL: "https://TU-SST-MANAGER-API.onrender.com"
```

por la URL real del Web Service.

## 6. Configurar CORS en Cloudflare R2

En:

`R2 > sst-manager-documentos > Settings > CORS`

usa el contenido de:

`cloudflare/r2-cors.json`

Antes de guardar, reemplaza:

```text
https://TU-SST-MANAGER.onrender.com
```

por la URL que tendrá tu página.

## 7. Publicar la página en Render

En Render crea:

`New > Static Site`

Usa el mismo repositorio.

Configura:

- Root Directory: `frontend`
- Build Command: dejar vacío
- Publish Directory: `.`

Render te dará la URL final del sistema.

Si cambió respecto a la que pusiste en `r2-cors.json`, actualiza CORS.

---

# DÓNDE VA CADA KEY

## `frontend/config.js`

Solo:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
API_URL
```

Estas son públicas.

## Render > Web Service > Environment

Aquí van los secretos:

```text
SUPABASE_SERVICE_ROLE_KEY
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

y también:

```text
SUPABASE_URL
R2_ENDPOINT
R2_BUCKET
ALLOWED_ORIGINS
```

### NUNCA

No pongas `R2_SECRET_ACCESS_KEY` ni `SUPABASE_SERVICE_ROLE_KEY` en:

- `index.html`
- `app.js`
- `config.js`
- GitHub

---

# Cómo queda EMO

Al consultar un DNI:

1. Lee el trabajador de Supabase.
2. Muestra sus EMO históricos.
3. Calcula vencimiento automáticamente.
4. Permite registrar/actualizar:
   - fecha
   - aptitud
   - restricción
   - PDF o imagen
5. Pide al backend una URL de carga temporal.
6. El navegador carga el archivo directamente al bucket privado R2.
7. Supabase guarda solo la ruta del documento.
8. Para visualizar, el backend entrega una URL temporal de 5 minutos.

Los archivos quedan organizados así:

```text
emo/
  DNI/
    FECHA_EXAMEN/
      UUID.pdf
```

---

# Seguridad

El bucket R2 debe mantenerse con **Public Access: Disabled**.

La base usa RLS y solo permite consultas a usuarios con sesión.

El backend comprueba la sesión de Supabase antes de firmar una URL de R2.

---

# Archivos del paquete

```text
frontend/
  index.html
  style.css
  config.js
  app.js

api/
  package.json
  server.js
  .env.example

supabase/
  01_schema.sql
  02_seed_datos.sql

cloudflare/
  r2-cors.json
```
