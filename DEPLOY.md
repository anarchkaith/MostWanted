# MostWanted Deploy Guide

## ⚡ Quick Start

```powershell
# Desplegar a producción (git push + auto-build)
deploy

# Ver estado del build
deploy -check

# Ver logs del build
deploy -logs

# Terminal SSH interactiva
deploy -ssh
```

## 🔧 Setup (Primera vez)

1. **Crear archivo de credenciales** (local, NO se sube a Git):
   ```
   C:\Users\Hacklife\.copilot\session-state\48b4a9e9-4d13-46f7-b4c7-c0d1a11d32e6\vps-credentials.env
   ```
   
   Contenido:
   ```env
   VPS_SSH_HOST=147.93.38.127
   VPS_SSH_PORT=65002
   VPS_SSH_USER=u950660407
   VPS_SSH_PASSWORD=<tu-contraseña>
   VPS_PROJECT_PATH=/home/u950660407/domains/mostwanted.kaithsrebels.com
   ```

2. **Verificar instalación de sshpass**:
   ```powershell
   winget install sshpass-win32
   ```

3. **Cargar el alias de PowerShell**:
   ```powershell
   . $PROFILE
   ```

## 📋 Flujo de Deploy

```
Tu código → git commit → deploy → GitHub push
                                      ↓
                           Hostinger webhook
                                      ↓
                           Auto-build en VPS
                                      ↓
                           npm install + npm run build
                                      ↓
                           public_html actualizado
                                      ↓
                           🌐 https://mostwanted.kaithsrebels.com/
```

## 📊 Detalles Técnicos

### Estructura en Hostinger
```
/home/u950660407/domains/mostwanted.kaithsrebels.com/
├── hbuilds/
│   ├── versions/          # Cada build genera una carpeta aquí
│   ├── current/           # Symlink al build activo
│   ├── logs/              # Logs de cada build
│   └── last-source/       # Último código clonado
├── public_html/           # Código servido en web (sincronizado desde hbuilds/current)
└── ...
```

### Qué incluye cada deploy
- ✅ Cambios en TypeScript/JavaScript
- ✅ Cambios en CSS/Tailwind
- ✅ Cambios en HTML
- ✅ Cambios en assets (PNG, fonts, etc.)
- ❌ node_modules (reinstalados en cada build)
- ❌ .git (ignorado)
- ❌ vps-credentials.env (protegido por .gitignore)

### Commits necesarios
```powershell
# Hacer cambios...
git add .
git commit -m "feat: Descripción de cambios"

# Luego desplegar
deploy
```

## 🔍 Troubleshooting

### El build falló
```powershell
deploy -logs
```

### El build está muy lento
- Espera a que termine (suele tomar 10-20s)
- Verifica con `deploy -check`

### Cambios no aparecen en web
1. Verifica que el push fue exitoso: `git log --oneline -1`
2. Espera 5-10 segundos a que Hostinger inicie el build
3. Verifica los logs: `deploy -logs`
4. Si hay error de CSS/JS: revisar el log detallado

### Error "npm not found" en SSH
- ✅ Es normal - npm se instala en el contenedor de build, no en el shell raíz
- Usa `deploy` para triggers builds, no accedas directamente a npm

## 🚀 Automatización Futura

Posibles mejoras:
- [ ] Notificaciones por Slack cuando un build falla
- [ ] Rollback automático si hay errores críticos
- [ ] Pre-deploy checks (linting, tests)
- [ ] Post-deploy verification (health check)

## 📝 Notas

- **Credenciales seguras**: Almacenadas localmente, nunca se suben a Git
- **Auto-deploy**: Hostinger detecta pushes a `main` automáticamente
- **Sin servidor**: No se ejecuta Node.js permanentemente, solo en build time
- **Versioning**: Cada build tiene un ID único en `hbuilds/versions/`

---

**Última actualización**: 2026-11-07  
**Stack**: Vite + Tailwind CSS + Vanilla JS  
**Hosting**: Hostinger cPanel
