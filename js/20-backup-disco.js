        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO: BACKUP AUTOMÁTICO A CARPETA LOCAL
        // Guarda backups en una carpeta elegida por el usuario (una sola vez).
        // Usa File System Access API (Chrome/Edge). Sin servidor. Sin instalar nada.
        //
        // Primera vez: el usuario elige la carpeta "backups" dentro de la app.
        // Siguiente veces: guarda ahí automáticamente sin preguntar.
        //
        // Fallback: si el navegador no soporta la API, descarga a Descargas.
        // ████████████████████████████████████████████████████████████████████

        const BackupDisco = (() => {
            const KEY_ULTIMO    = 'APPBOGADO_LAST_BACKUP_DISCO';
            const KEY_CARPETA   = 'APPBOGADO_BACKUP_DIR_HANDLE'; // no se puede guardar el handle real, pero sí el nombre
            const INTERVALO_H   = 24;
            const USERS_KEY     = 'APPBOGADO_USERS_V2';

            // Handle de la carpeta seleccionada (vive en memoria durante la sesión)
            let _dirHandle = null;

            // ── Construir objeto de backup completo ─────────────────────────
            function _construirBackup(motivo) {
                return {
                    app: 'AppBogado',
                    version: '20.0',
                    motivo,
                    fechaExportacion: new Date().toISOString(),
                    datos: {
                        clientes:      Store.clientes,
                        causas:        Store.causas,
                        jurisprudencia:Store.jurisprudencia,
                        documentos:    Store.documentos,
                        prospectos:    Store.prospectos,
                        alertas:       Store.alertas,
                        bitacora:      Store.bitacora,
                        configuracion: Store.configuracion,
                        _usuarios:     AppConfig.get('usuarios') || []
                    }
                };
            }

            // ── Nombre del archivo ──────────────────────────────────────────
            function _nombreArchivo() {
                const f = new Date();
                const fecha = f.toISOString().slice(0,10);
                const hora  = f.toTimeString().slice(0,5).replace(':','-');
                return `AppBogado_Backup_${fecha}_${hora}.json`;
            }

            // ── Soporte de File System Access API ──────────────────────────
            function _soportaFSAPI() {
                return ('showDirectoryPicker' in window);
            }

            // ── Pedir al usuario que elija la carpeta de backups ────────────
            async function elegirCarpeta() {
                if (!_soportaFSAPI()) {
                    alert('Tu navegador no soporta seleccion de carpeta.\nUsa Chrome o Edge para esta funcion.\nLos backups se guardaran en Descargas.');
                    return false;
                }
                try {
                    _dirHandle = await window.showDirectoryPicker({
                        id: 'appbogado-backups',
                        mode: 'readwrite',
                        startIn: 'documents'
                    });
                    // Guardar nombre para mostrar en UI
                    AppConfig.set('backup_carpeta', _dirHandle.name);
                    _actualizarIndicador();
                    if (typeof showSuccess === 'function') {
                        showSuccess('Carpeta "' + _dirHandle.name + '" seleccionada. Los backups se guardaran ahi automaticamente.');
                    }
                    return true;
                } catch (e) {
                    if (e.name !== 'AbortError') console.error('[BackupDisco] Error eligiendo carpeta:', e);
                    return false;
                }
            }

            // ── Guardar archivo en la carpeta seleccionada ──────────────────
            async function _guardarEnCarpeta(json, nombre) {
                try {
                    const fileHandle = await _dirHandle.getFileHandle(nombre, { create: true });
                    const writable   = await fileHandle.createWritable();
                    await writable.write(json);
                    await writable.close();
                    return true;
                } catch (e) {
                    console.error('[BackupDisco] Error escribiendo archivo:', e);
                    return false;
                }
            }

            // ── Fallback: descargar a Descargas ─────────────────────────────
            function _descargarFallback(json, nombre) {
                const blob = new Blob([json], { type: 'application/json; charset=utf-8' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = nombre;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 2000);
            }

            // ── Función principal de backup ─────────────────────────────────
            async function _hacerBackup(motivo = 'auto', silencioso = false) {
                const backup = _construirBackup(motivo);
                const json   = JSON.stringify(backup, null, 2);
                const nombre = _nombreArchivo();
                let   ok     = false;

                if (_dirHandle) {
                    // Intentar escribir en carpeta seleccionada
                    ok = await _guardarEnCarpeta(json, nombre);
                    if (!ok) {
                        // Permiso expiró — pedir de nuevo
                        try {
                            const perm = await _dirHandle.requestPermission({ mode: 'readwrite' });
                            if (perm === 'granted') ok = await _guardarEnCarpeta(json, nombre);
                        } catch(e) {}
                    }
                    if (!ok) {
                        // Fallback si falla
                        _descargarFallback(json, nombre);
                        ok = true;
                    }
                } else {
                    // Sin carpeta elegida: descargar a Descargas
                    _descargarFallback(json, nombre);
                    ok = true;
                }

                if (ok) {
                    AppConfig.set('backup_ultimo', new Date().toISOString());
                    _actualizarIndicador();
                    if (!silencioso && typeof showSuccess === 'function') {
                        const destino = _dirHandle ? '"' + _dirHandle.name + '"' : 'Descargas';
                        showSuccess('Backup guardado en ' + destino + ': ' + nombre);
                    }
                }
                return ok;
            }

            // ── Indicador visual en sidebar ─────────────────────────────────
            function _actualizarIndicador() {
                const el = document.getElementById('backup-disco-estado');
                if (!el) return;
                const ultimo   = AppConfig.get('backup_ultimo');
                const carpeta  = AppConfig.get('backup_carpeta');
                const destino  = carpeta ? '"' + carpeta + '"' : 'Descargas';

                if (!ultimo) {
                    el.innerHTML = 'Sin backup aun &mdash; ' + destino;
                    el.style.color = '#e57373';
                } else {
                    const hace  = Math.floor((Date.now() - new Date(ultimo).getTime()) / 3600000);
                    const fecha = new Date(ultimo).toLocaleDateString('es-CL');
                    if (hace < 24) {
                        el.innerHTML = 'Hoy ' + fecha + ' &rarr; ' + destino;
                        el.style.color = '#66bb6a';
                    } else {
                        el.innerHTML = 'Hace ' + Math.floor(hace/24) + ' dia(s) &rarr; ' + destino;
                        el.style.color = '#ffa726';
                    }
                }
            }

            // ── Aviso si no hay backup reciente ─────────────────────────────
            function _mostrarAvisoSiNecesario() {
                const ultimo = AppConfig.get('backup_ultimo');
                const hace   = ultimo ? (Date.now() - new Date(ultimo).getTime()) / 3600000 : 999;
                if (hace < 24) return;

                setTimeout(() => {
                    // No crear dos avisos
                    if (document.getElementById('backup-aviso-disco')) return;
                    const aviso = document.createElement('div');
                    aviso.id = 'backup-aviso-disco';
                    aviso.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#1a3a5c;color:#fff;border-radius:12px;padding:16px 20px;box-shadow:0 4px 20px rgba(0,0,0,0.35);max-width:300px;font-size:13px;line-height:1.5;';
                    const msg = ultimo
                        ? 'Ultimo backup: ' + new Date(ultimo).toLocaleDateString('es-CL')
                        : 'Aun no tienes backup guardado.';
                    aviso.innerHTML =
                        '<div style="font-weight:700;margin-bottom:6px;">Backup recomendado</div>' +
                        '<div style="opacity:0.85;margin-bottom:12px;">' + msg + '</div>' +
                        '<div style="display:flex;gap:8px;">' +
                            '<button onclick="BackupDisco.hacerAhora();document.getElementById(\'backup-aviso-disco\').remove();" ' +
                                'style="flex:1;padding:7px;background:#c9a84c;border:none;border-radius:7px;color:#fff;font-weight:600;cursor:pointer;">Guardar ahora</button>' +
                            '<button onclick="document.getElementById(\'backup-aviso-disco\').remove();" ' +
                                'style="padding:7px 12px;background:rgba(255,255,255,0.15);border:none;border-radius:7px;color:#fff;cursor:pointer;">Luego</button>' +
                        '</div>';
                    document.body.appendChild(aviso);
                    setTimeout(() => aviso && aviso.remove(), 15000);
                }, 2500);
            }

            // ── API pública ─────────────────────────────────────────────────
            return {
                iniciar() {
                    _actualizarIndicador();
                    _mostrarAvisoSiNecesario();
                    window.addEventListener('beforeunload', () => {
                        const ultimo = AppConfig.get('backup_ultimo');
                        const hace   = ultimo ? (Date.now() - new Date(ultimo).getTime()) / 3600000 : 999;
                        if (hace >= 24) _hacerBackup('cierre-auto', true);
                    });
                },
                hacerAhora(motivo = 'manual') {
                    return _hacerBackup(motivo, false);
                },
                elegirCarpeta,
                tieneCarpeta() { return !!_dirHandle; },
                actualizarIndicador: _actualizarIndicador,
            };
        })();
