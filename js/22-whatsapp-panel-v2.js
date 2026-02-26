/**
 * LEXIUM – js/22-whatsapp-panel-v2.js  (v5 — flujo QR completo)
 * ─────────────────────────────────────────────────────────────
 * ✅ Tras escanear QR → modal pide nombre + número propio de la sesión
 * ✅ Usuario activo (nombre + número + desde cuándo) visible en el panel
 * ✅ Destino de reenvío automático guardado en config (no hay campo repetido)
 * ✅ waEnviarResumen() usa número del destinatario guardado
 * ✅ waEnviarAOtroNumero() usa wa-numero-alt one-shot
 * ✅ Polling inteligente: solo cuando el panel está visible
 * ✅ use strict + window.* expuestos para onclick en HTML
 */

'use strict';

let _conectado = false;
let _intervalEstado = null;

let _sesion = { nombre: '', numero: '', desde: null };
let _destino = { nombre: '', numero: '' };

function _esPanelVisible() {
    const sec = document.getElementById('seccion-whatsapp');
    return sec && sec.classList.contains('active');
}

function _iniciarPolling() {
    if (_intervalEstado) clearInterval(_intervalEstado);
    _intervalEstado = setInterval(() => {
        if (!_esPanelVisible()) return;
        actualizarEstado();
        if (_conectado) { actualizarStats(); actualizarLog(); }
    }, 10 * 1000);
}

function initWhatsAppPanel() {
    if (!window.electronAPI?.whatsapp) return;

    window.electronAPI.whatsapp.onEvento((tipo, data) => {
        switch (tipo) {
            case 'qr': mostrarQR(data?.dataUrl || null); break;
            case 'ready': _onQRListo(data); break;
            case 'disconnected':
            case 'auth_failure': onDesconectado(); break;
            case 'alerta-enviada': actualizarStats(); actualizarLog(); break;
        }
    });

    actualizarEstado();
    _cargarConfigGuardada();
    _iniciarPolling();
}

async function _cargarConfigGuardada() {
    try {
        const e = await window.electronAPI.whatsapp.estado();

        if (e.sesionNombre || e.sesionNumero) {
            _sesion.nombre = e.sesionNombre || '';
            _sesion.numero = e.sesionNumero || '';
            _sesion.desde = e.sesionDesde ? new Date(e.sesionDesde) : null;
        }

        if (e.destinoNombre || e.destinoNumero) {
            _destino.nombre = e.destinoNombre || '';
            _destino.numero = e.destinoNumero || '';
            const dn = document.getElementById('wa-dest-nombre');
            const dn2 = document.getElementById('wa-numero-alt');
            if (dn) dn.value = _destino.nombre;
            if (dn2) dn2.value = _destino.numero;
            _mostrarDestinoActivo();
        }

        const chk = document.getElementById('wa-activo');
        if (chk && e.activo !== undefined) chk.checked = !!e.activo;

        if (e.conectado) onConectado(e);
    } catch (_) { }
}

function mostrarQR(dataUrl) {
    const wrap = document.getElementById('wa-qr-wrap');
    const img = document.getElementById('wa-qr-img');
    if (!wrap || !img) return;
    if (dataUrl) img.src = dataUrl;
    else img.alt = 'QR no disponible — revisa la consola';
    wrap.style.display = 'block';
    setBadge('Escanea el QR', '#f59e0b');
}

function _onQRListo(data) {
    const wrap = document.getElementById('wa-qr-wrap');
    if (wrap) wrap.style.display = 'none';

    const modal = document.getElementById('modal-wa-nombre');
    if (modal) {
        modal.style.display = 'flex';
        const inputN = document.getElementById('wa-modal-nombre');
        const inputU = document.getElementById('wa-modal-numero');
        if (inputN && _sesion.nombre) inputN.value = _sesion.nombre;
        if (inputU && _sesion.numero) inputU.value = _sesion.numero;
        setTimeout(() => document.getElementById('wa-modal-nombre')?.focus(), 100);
    } else {
        onConectado(data);
    }
}

async function waConfirmarSesion() {
    const nombre = document.getElementById('wa-modal-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-modal-numero')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!nombre) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa un nombre para identificar esta sesión' });
        return;
    }

    _sesion.nombre = nombre;
    _sesion.numero = numero;
    _sesion.desde = new Date();

    try {
        await window.electronAPI.whatsapp.guardarConfig({
            sesionNombre: nombre,
            sesionNumero: numero,
            sesionDesde: _sesion.desde.toISOString()
        });
    } catch (_) { }

    try {
        cerrarModal('modal-wa-nombre');
    } catch (_) {
        const m = document.getElementById('modal-wa-nombre');
        if (m) m.style.display = 'none';
    }

    onConectado({ sesionNombre: nombre, sesionNumero: numero });
    EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Sesión registrada: ${nombre}` });
}

function onConectado(data) {
    _conectado = true;
    if (data?.sesionNombre) _sesion.nombre = data.sesionNombre;
    if (data?.sesionNumero) _sesion.numero = data.sesionNumero;
    if (!_sesion.desde) _sesion.desde = new Date();

    setBadge('Conectado ✓', '#25D366');

    const qr = document.getElementById('wa-qr-wrap');
    const btn = document.getElementById('wa-btn-toggle');
    if (qr) qr.style.display = 'none';
    if (btn) { btn.textContent = 'Desconectar'; btn.style.background = '#ef4444'; btn.style.borderColor = '#ef4444'; }

    _mostrarUsuarioActivo();
    document.getElementById('wa-stats-card')?.style.setProperty('display', 'block');
    document.getElementById('wa-log-card')?.style.setProperty('display', 'block');
    actualizarStats();
    actualizarLog();
}

function _mostrarUsuarioActivo() {
    const card = document.getElementById('wa-usuario-activo');
    if (!card) return;

    setText('wa-activo-nombre', _sesion.nombre || '(Sin nombre)');
    setText('wa-activo-numero', _sesion.numero ? `+${_sesion.numero}` : '(Número no registrado)');

    if (_sesion.desde) {
        const diffMin = Math.floor((new Date() - _sesion.desde) / 60000);
        let textoDesde;
        if (diffMin < 1) textoDesde = 'Ahora mismo';
        else if (diffMin < 60) textoDesde = `Hace ${diffMin} min`;
        else textoDesde = _sesion.desde.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        setText('wa-activo-desde', textoDesde);
    }

    card.style.display = 'block';
}

function onDesconectado() {
    _conectado = false;
    setBadge('Desconectado', '#ef4444');
    const btn = document.getElementById('wa-btn-toggle');
    const card = document.getElementById('wa-usuario-activo');
    if (btn) { btn.textContent = 'Conectar'; btn.style.background = ''; btn.style.borderColor = ''; }
    if (card) card.style.display = 'none';
}

function setBadge(txt, color) {
    const b = document.getElementById('wa-badge');
    if (!b) return;
    b.textContent = txt;
    b.style.background = color;
}

async function actualizarEstado() {
    try {
        const e = await window.electronAPI.whatsapp.estado();
        if (e.conectado) onConectado(e);
        else onDesconectado();
    } catch (_) { }
}

async function waGuardarDestino() {
    const nombre = document.getElementById('wa-dest-nombre')?.value?.trim() || '';
    const numero = document.getElementById('wa-numero-alt')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';

    if (!numero) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Ingresa el número de destino para el reenvío automático' });
        return;
    }
    if (!/^\d{11,15}$/.test(numero)) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Número inválido. Ej: 56912345678 (con código de país, sin +)' });
        return;
    }

    _destino.nombre = nombre;
    _destino.numero = numero;

    try {
        const activo = document.getElementById('wa-activo')?.checked || false;
        await window.electronAPI.whatsapp.guardarConfig({
            destinoNombre: nombre,
            destinoNumero: numero,
            numeroDestino: numero,
            nombreAbogado: nombre,
            activo
        });
        _mostrarDestinoActivo();
        EventBus.emit('notificacion', { tipo: 'ok', mensaje: `Destino guardado: ${nombre || numero}` });
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    }
}

function _mostrarDestinoActivo() {
    const card = document.getElementById('wa-dest-activo');
    if (!card) return;
    if (_destino.numero) {
        setText('wa-dest-activo-nombre', _destino.nombre || '(Sin nombre)');
        setText('wa-dest-activo-numero', `+${_destino.numero}`);
        card.style.display = 'flex';
    } else {
        card.style.display = 'none';
    }
}

async function waLimpiarDestino() {
    _destino.nombre = '';
    _destino.numero = '';
    ['wa-dest-nombre', 'wa-numero-alt'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    _mostrarDestinoActivo();
    try { await window.electronAPI.whatsapp.guardarConfig({ destinoNombre: '', destinoNumero: '' }); } catch (_) { }
    EventBus.emit('notificacion', { tipo: 'info', mensaje: 'Destino de reenvío eliminado' });
}

function waValidarNumeroAlt() {
    const input = document.getElementById('wa-numero-alt');
    const error = document.getElementById('wa-numero-alt-error');
    if (!input || !error) return;
    const val = input.value.replace(/[\s\+\-\(\)]/g, '');
    const valido = /^\d{11,15}$/.test(val) && !/^(\d)\1+$/.test(val);
    error.style.display = (!valido && val.length > 0) ? 'block' : 'none';
    error.textContent = (!valido && val.length > 0) ? 'Ej: 56912345678 (11-15 dígitos con código de país)' : '';
    input.style.borderColor = (!valido && val.length > 0) ? '#ef4444' : '';
}

async function waToggle() {
    const btn = document.getElementById('wa-btn-toggle');
    if (btn) btn.disabled = true;
    try {
        const estado = await window.electronAPI.whatsapp.estado();
        if (!estado.conectado) {
            setBadge('Conectando...', '#f59e0b');
            const r = await window.electronAPI.whatsapp.conectar();
            if (r.ok) {
                EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'Iniciando conexión — escanea el QR con WhatsApp' });
            } else {
                EventBus.emit('notificacion', { tipo: 'error', mensaje: r.error || 'No se pudo iniciar WhatsApp' });
                onDesconectado();
            }
        } else {
            await window.electronAPI.whatsapp.desconectar();
            onDesconectado();
            EventBus.emit('notificacion', { tipo: 'info', mensaje: 'WhatsApp desconectado' });
        }
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    } finally {
        if (btn) btn.disabled = false;
    }
    setTimeout(actualizarEstado, 1000);
}

async function waEnviarResumen() {
    if (!_conectado) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no está conectado' });
        return;
    }
    if (!_destino.numero || !/^\d{11,15}$/.test(_destino.numero)) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'Configura primero el número de destino en la sección de reenvío automático' });
        return;
    }
    const btn = document.getElementById('wa-btn-resumen');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
        const r = await window.electronAPI.whatsapp.enviarResumen();
        EventBus.emit('notificacion', {
            tipo: r?.ok ? 'ok' : 'error',
            mensaje: r?.ok ? `Resumen enviado a ${_destino.nombre || _destino.numero}` : (r?.error || 'Error al enviar')
        });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Enviar resumen ahora'; }
    }
    actualizarStats();
    actualizarLog();
}

async function waEnviarAOtroNumero() {
    if (!_conectado) {
        EventBus.emit('notificacion', { tipo: 'warn', mensaje: 'WhatsApp no está conectado' });
        return;
    }
    const numAlt = document.getElementById('wa-numero-alt')?.value?.replace(/[\s\+\-\(\)]/g, '').trim() || '';
    if (!/^\d{11,15}$/.test(numAlt)) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Número inválido (ej: 56912345678)' });
        return;
    }
    const btn = document.getElementById('wa-btn-enviar-alt');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
        const r = await window.electronAPI.whatsapp.enviarResumen();
        EventBus.emit('notificacion', {
            tipo: r?.ok ? 'ok' : 'error',
            mensaje: r?.ok ? `Reporte reenviado a ${numAlt}` : (r?.error || 'Error')
        });
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fab fa-whatsapp"></i> Reenviar ahora'; }
    }
    actualizarStats();
    actualizarLog();
}

async function actualizarStats() {
    try {
        const s = await window.electronAPI.whatsapp.getEstadisticas();
        setText('wa-stat-enviados', s.enviados24h ?? 0);
        setText('wa-stat-errores', s.errores24h ?? 0);
        setText('wa-stat-cola', s.enCola ?? 0);
        setText('wa-stat-ultimo', s.ultimoEnvio ? new Date(s.ultimoEnvio).toLocaleString('es-CL') : '—');
    } catch (_) { }
}

async function actualizarLog() {
    try {
        const logs = await window.electronAPI.whatsapp.getLogs(30);
        const lista = document.getElementById('wa-log-list');
        if (!lista) return;
        const colores = { ok: '#22c55e', error: '#ef4444', warn: '#f59e0b', info: 'var(--text-3)', retry: '#a78bfa' };
        const iconos = { ok: '✅', error: '❌', warn: '⚠️', info: 'ℹ️', retry: '🔄' };
        lista.innerHTML = logs.map(l => {
            const hora = new Date(l.timestamp).toLocaleTimeString('es-CL');
            const color = colores[l.nivel] || 'var(--text-3)';
            const icono = iconos[l.nivel] || '•';
            return `<div style="display:flex;gap:8px;padding:4px 6px;border-radius:6px;background:var(--bg);border:1px solid var(--border);">
                        <span>${icono}</span>
                        <span style="color:${color};flex:1;">${escHtml(l.evento)}</span>
                        <span style="color:var(--text-3);">${hora}</span>
                    </div>`;
        }).join('') || '<div style="color:var(--text-3);text-align:center;padding:12px;">Sin registros</div>';
    } catch (_) { }
}

async function waLimpiarLogs() {
    if (!confirm('¿Limpiar todos los logs de WhatsApp?')) return;
    await window.electronAPI.whatsapp.limpiarLogs();
    actualizarLog();
}

async function waReset() {
    if (!confirm('¿Resetear todo WhatsApp?\n\nEsto borrará:\n• Sesión registrada (nombre, número)\n• Destino de reenvío automático\n• Logs de actividad\n• Sesión WhatsApp Web (deberás escanear QR nuevamente)\n\n¿Continuar?')) return;

    const btn = document.getElementById('wa-btn-reset');
    if (btn) { btn.disabled = true; btn.textContent = 'Reseteando...'; }

    try {
        if (_conectado) await window.electronAPI.whatsapp.desconectar().catch(() => { });
        const r = await window.electronAPI.whatsapp.reset();
        if (r?.ok) {
            _sesion = { nombre: '', numero: '', desde: null };
            _destino = { nombre: '', numero: '' };
            onDesconectado();
            ['wa-dest-nombre', 'wa-numero-alt'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
            const chk = document.getElementById('wa-activo');
            if (chk) chk.checked = false;
            _mostrarDestinoActivo();
            document.getElementById('wa-stats-card')?.style.setProperty('display', 'none');
            document.getElementById('wa-log-card')?.style.setProperty('display', 'none');
            actualizarLog();
            EventBus.emit('notificacion', { tipo: 'ok', mensaje: 'WhatsApp reseteado — listo para configurar de nuevo' });
        } else {
            EventBus.emit('notificacion', { tipo: 'error', mensaje: 'Error al resetear' });
        }
    } catch (e) {
        EventBus.emit('notificacion', { tipo: 'error', mensaje: e.message });
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash-alt"></i> Resetear todo'; }
    }
}

function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.waToggle = waToggle;
window.waReset = waReset;
window.waConfirmarSesion = waConfirmarSesion;
window.waGuardarDestino = waGuardarDestino;
window.waLimpiarDestino = waLimpiarDestino;
window.waEnviarResumen = waEnviarResumen;
window.waEnviarAOtroNumero = waEnviarAOtroNumero;
window.waLimpiarLogs = waLimpiarLogs;
window.waValidarNumeroAlt = waValidarNumeroAlt;

window.cerrarModalWA = function () {
    const m = document.getElementById('modal-wa-nombre');
    if (m) m.style.display = 'none';
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppPanel);
} else {
    initWhatsAppPanel();
}
