        // FUNCIONES NUEVAS — 15 MEJORAS
        // ═══════════════════════════════════════════════════════════════

        // ─── UTILS MODAL ─────────────────────────────────────────────────
        function abrirModal(id) { document.getElementById(id).classList.add('open'); }
        function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

        // ─── 1. VISTA DETALLE DE CAUSA (modal completo) ───────────────────
        // ─── Tab activo en detalle de causa ──────────────────────────────
        let _dcTabActivo = 'movimientos';

        function dcCambiarTab(tab, causaId) {
            _dcTabActivo = tab;
            document.querySelectorAll('#modal-detalle .dc-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#modal-detalle .dc-tab-panel').forEach(p => p.classList.remove('active'));
            const btnEl = document.getElementById(`dctab-${tab}`);
            const panEl = document.getElementById(`dcpanel-${tab}`);
            if (btnEl) btnEl.classList.add('active');
            if (panEl) panEl.classList.add('active');
            // Render del panel activo
            if (tab === 'movimientos') dcRenderMovimientos(causaId);
            if (tab === 'tareas') dcRenderTareas(causaId);
            if (tab === 'partes') dcRenderPartes(causaId);
            if (tab === 'economico') dcRenderEconomico(causaId);
        }

        function abrirDetalleCausa(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            evaluarRiesgoIntegral(causaId);

            // Inicializar estructuras si no existen
            if (!causa.tareas) causa.tareas = [];
            if (!causa.partes) causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };
            if (!causa.movimientos) causa.movimientos = [];

            const hon = causa.honorarios || {};
            const etapas = causa.etapasProcesales || [];
            const docs = causa.documentos || [];

            // Contadores para badges
            const tareasPend = causa.tareas.filter(t => !t.done).length;
            const tareasTotal = causa.tareas.length;
            const movCount = causa.movimientos.length + docs.length;

            // Badge estado
            const badgeClass = causa.estadoGeneral === 'Finalizada' ? 'dc-badge-done'
                : causa.estadoGeneral === 'Suspendida' ? 'dc-badge-suspended'
                    : 'dc-badge-active';

            // Cliente asociado
            const cliente = DB.clientes.find(c => c.id === causa.clienteId);

            document.getElementById('modal-detalle-titulo').innerHTML = '';  // limpiamos title (usamos header interno)

            document.getElementById('modal-detalle-body').innerHTML = `

        <!-- ══ HEADER DE CAUSA ══ -->
        <div class="dc-header">
            <div class="dc-breadcrumb">
                <a onclick="cerrarModal('modal-detalle')"><i class="fas fa-home"></i> Inicio</a>
                <span class="bc-sep">/</span>
                <a onclick="cerrarModal('modal-detalle'); tab('causas',null);">Listado de Causas</a>
                <span class="bc-sep">/</span>
                <span class="bc-current">${escHtml(causa.caratula).substring(0, 40)}${causa.caratula.length > 40 ? '…' : ''}</span>
            </div>

            <div class="dc-title-row">
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:6px;">
                        <h2 class="dc-title">${escHtml(causa.caratula)}</h2>
                        <span class="dc-badge ${badgeClass}">${escHtml(causa.estadoGeneral || 'En tramitación')}</span>
                    </div>
                    <div class="dc-meta-row">
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">RIT / RUC</div>
                            <div class="dc-meta-value">${escHtml(causa.rut || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Cliente</div>
                            <div class="dc-meta-value">${escHtml(cliente?.nombre || causa.cliente || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Procedimiento</div>
                            <div class="dc-meta-value">${escHtml(causa.tipoProcedimiento || '—')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Instancia</div>
                            <div class="dc-meta-value">${escHtml(causa.instancia || 'Primera')}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Último movimiento</div>
                            <div class="dc-meta-value">${causa.fechaUltimaActividad ? new Date(causa.fechaUltimaActividad).toLocaleDateString('es-CL') : '—'}</div>
                        </div>
                        <div class="dc-meta-item">
                            <div class="dc-meta-label">Avance</div>
                            <div class="dc-meta-value" style="color:#1a3a6b; font-family:'IBM Plex Mono',monospace;">${causa.porcentajeAvance || 0}%</div>
                        </div>
                    </div>
                    <div class="dc-avance-strip"><div class="dc-avance-fill" style="width:${causa.porcentajeAvance || 0}%"></div></div>
                </div>

                <div class="dc-actions">
                    ${causa.estadoGeneral !== 'Finalizada'
                    ? `<button class="dc-btn danger" onclick="uiCerrarCausa(${causaId})"><i class="fas fa-lock"></i> Cerrar</button>`
                    : `<button class="dc-btn success" onclick="uiReactivarCausa(${causaId})"><i class="fas fa-lock-open"></i> Reactivar</button>`}
                    <button class="dc-btn" onclick="exportarPDFCausa(${causaId})"><i class="fas fa-file-pdf"></i> PDF</button>
                    <button class="dc-btn" onclick="_abrirModalAdjuntos('${causaId}')" title="Archivos adjuntos">
                        <i class="fas fa-paperclip"></i> Adjuntos
                        <span style="background:rgba(255,255,255,0.3);border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px;">${(causa.adjuntos||[]).length || 0}</span>
                    </button>
                    <button class="dc-btn" onclick="lexbotAbrirConCausa('${causaId}')" title="Consultar LexBot con contexto de esta causa"
                        style="background:linear-gradient(135deg,#0891b2,#0d5e8a);">
                        <i class="fas fa-robot"></i> LexBot
                    </button>
                    <button class="dc-btn" onclick="cerrarModal('modal-detalle'); exportarInformeMejorado('${causaId}')" title="Generar informe PDF profesional">
                        <i class="fas fa-star"></i> PDF Pro
                    </button>
                    <button class="dc-btn primary" onclick="cerrarModal('modal-detalle'); tab('estrategia-pro',null); document.getElementById('ep-causa-sel').value=${causaId}; uiRenderEstrategiaPro();">
                        <i class="fas fa-chess"></i> Estrategia
                    </button>
                </div>
            </div>
        </div>

        <!-- ══ LAYOUT: sidebar + tabs ══ -->
        <div class="dc-layout">

            <!-- ── SIDEBAR ── -->
            <div class="dc-sidebar">

                <!-- Bitácora de etapas -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header">
                        <span><i class="fas fa-list-check"></i> Etapas</span>
                    </div>
                    <div class="dc-sidebar-body">
                        ${etapas.length ? etapas.map((e, i) => `
                            <div style="display:flex; gap:8px; align-items:flex-start; margin-bottom:10px;">
                                <div class="etapa-check ${e.completada ? 'done' : 'pending'}" style="flex-shrink:0;"
                                    onclick="uiMarcarEtapa(${causaId},${i})">
                                    ${e.completada ? '<i class="fas fa-check" style="font-size:0.55rem;"></i>' : ''}
                                </div>
                                <div style="flex:1; min-width:0;">
                                    <div style="font-size:0.78rem; font-weight:600; color:${e.completada ? '#94a3b8' : '#0f172a'}; ${e.completada ? 'text-decoration:line-through;' : ''}">${escHtml(e.nombre)}</div>
                                    ${e.fecha ? `<div style="font-size:0.68rem; color:#94a3b8; font-family:'IBM Plex Mono',monospace;">${new Date(e.fecha).toLocaleDateString('es-CL')}</div>` : ''}
                                </div>
                            </div>`).join('')
                    : '<p style="font-size:0.78rem; color:#94a3b8;">Sin etapas definidas.</p>'}
                    </div>
                </div>

                <!-- Riesgo -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header">
                        <span><i class="fas fa-shield-alt"></i> Riesgo</span>
                    </div>
                    <div class="dc-sidebar-body">
                        ${Object.entries(causa.riesgo || {}).map(([k, v]) => {
                        const c = v === 'Alto' ? '#c0392b' : v === 'Medio' ? '#b45309' : '#0d7a5f';
                        return `<div class="dc-field">
                                <div class="dc-field-label">${k}</div>
                                <div class="dc-field-value" style="color:${c}; font-weight:700;">${v}</div>
                            </div>`;
                    }).join('') || '<p style="font-size:0.78rem; color:#94a3b8;">Sin evaluación.</p>'}
                    </div>
                </div>

                <!-- Acciones extra -->
                <div class="dc-sidebar-card">
                    <div class="dc-sidebar-header"><span><i class="fas fa-bolt"></i> Acciones</span></div>
                    <div class="dc-sidebar-body" style="display:flex; flex-direction:column; gap:6px;">
                        <button class="dc-btn" style="justify-content:flex-start; font-size:0.76rem;"
                            onclick="uiAbrirBuscarJuris(${causaId})">
                            <i class="fas fa-book"></i> Asociar jurisprudencia
                        </button>
                        <button class="dc-btn" style="justify-content:flex-start; font-size:0.76rem;"
                            onclick="uiDuplicarCausa(${causaId})">
                            <i class="fas fa-copy"></i> Duplicar causa
                        </button>
                    </div>
                </div>
            </div>

            <!-- ── PANEL PRINCIPAL CON TABS ── -->
            <div>
                <!-- Tabs bar -->
                <div class="dc-tabs-bar">
                    <button id="dctab-movimientos" class="dc-tab-btn active"
                        onclick="dcCambiarTab('movimientos',${causaId})">
                        <i class="fas fa-exchange-alt"></i> Movimientos
                        <span class="dc-tab-badge">${movCount}</span>
                    </button>
                    <button id="dctab-tareas" class="dc-tab-btn"
                        onclick="dcCambiarTab('tareas',${causaId})">
                        <i class="fas fa-tasks"></i> Tareas
                        <span class="dc-tab-badge">${tareasPend > 0 ? `${tareasPend}/${tareasTotal}` : tareasTotal}</span>
                    </button>
                    <button id="dctab-economico" class="dc-tab-btn"
                        onclick="dcCambiarTab('economico',${causaId})">
                        <i class="fas fa-coins"></i> Datos económicos
                    </button>
                    <button id="dctab-partes" class="dc-tab-btn"
                        onclick="dcCambiarTab('partes',${causaId})">
                        <i class="fas fa-users"></i> Usuarios y partes
                    </button>
                </div>

                <!-- Tab panels -->
                <div id="dcpanel-movimientos" class="dc-tab-panel active"></div>
                <div id="dcpanel-tareas"       class="dc-tab-panel"></div>
                <div id="dcpanel-economico"    class="dc-tab-panel"></div>
                <div id="dcpanel-partes"       class="dc-tab-panel"></div>
            </div>
        </div>
    `;
            abrirModal('modal-detalle');
            // Render tab inicial
            dcCambiarTab('movimientos', causaId);
        }

        // ════════════════════════════════════════════════════════
        // TAB 1: MOVIMIENTOS + DOCUMENTOS (timeline unificado)
        // ════════════════════════════════════════════════════════
        function dcRenderMovimientos(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const el = document.getElementById('dcpanel-movimientos');
            if (!el) return;

            const movs = (causa.movimientos || []).map(m => ({ ...m, _origen: 'mov' }));
            const docs = (causa.documentos || []).map(d => ({
                id: d.id, nombre: d.nombreOriginal || 'Documento',
                fecha: d.fechaDocumento, tipo: d.tipo || 'Documento',
                cuaderno: d.cuaderno || 'Principal', etapa: d.etapaVinculada || '—',
                folio: d.folio || '—', _origen: 'doc'
            }));
            const todos = [...movs, ...docs].sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

            el.innerHTML = `
            <div class="dc-mov-toolbar">
                <input class="dc-search-mov" id="dc-search-mov-${causaId}"
                    placeholder="Buscar movimientos..." oninput="dcFiltrarMovimientos(${causaId})">
                <select class="dc-cuaderno-sel" id="dc-cuaderno-${causaId}"
                    onchange="dcFiltrarMovimientos(${causaId})">
                    <option value="">Todos los cuadernos</option>
                    <option>Principal</option>
                    <option>Reconvencional</option>
                    <option>Incidental</option>
                </select>
                <span class="dc-mov-count" id="dc-mov-count-${causaId}">${todos.length} movimiento${todos.length !== 1 ? 's' : ''}</span>
            </div>
            <div id="dc-mov-list-${causaId}">
                ${dcMovHtml(todos)}
            </div>
            ${causa.estadoGeneral !== 'Finalizada' ? `
            <div style="margin-top:14px; padding-top:14px; border-top:1px dashed #e4eaf3; display:flex; gap:8px;">
                <input id="dc-new-mov-nombre-${causaId}" placeholder="Nombre del trámite..."
                    style="flex:1; padding:7px 10px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.8rem; font-family:'IBM Plex Sans',sans-serif;">
                <select id="dc-new-mov-tipo-${causaId}"
                    style="padding:7px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc;">
                    <option>Resolución</option><option>Escrito</option><option>Notificación</option>
                    <option>Audiencia</option><option>Sentencia</option><option>Otro</option>
                </select>
                <button class="dc-btn primary" onclick="dcAgregarMovimiento(${causaId})">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>` : ''}`;
        }

        function dcMovHtml(items) {
            if (!items.length) return '<div class="empty-state" style="padding:30px 0; text-align:center; color:#94a3b8;"><i class="fas fa-exchange-alt" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>Sin movimientos registrados</div>';
            const iconMap = { Resolución: '⚖️', Escrito: '📄', Notificación: '🔔', Audiencia: '🏛️', Sentencia: '📜', Documento: '📎', default: '📋' };
            return items.map(m => `
            <div class="dc-mov-card" data-nombre="${escHtml((m.nombre || m.tipo || '').toLowerCase())}" data-cuaderno="${(m.cuaderno || 'Principal').toLowerCase()}">
                <div class="dc-mov-header">
                    <div class="dc-mov-title">
                        <div class="dc-mov-icon">${iconMap[m.tipo] || iconMap.default}</div>
                        <div>
                            <div class="dc-mov-name">${escHtml(m.nombre || m.tipo || 'Movimiento')}</div>
                            <div class="dc-mov-date">${m.fecha ? new Date(m.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                        </div>
                    </div>
                    <div class="dc-mov-badges">
                        <span class="dc-mov-badge dc-mov-badge-principal">${m.cuaderno || 'Principal'}</span>
                        <span class="dc-mov-badge dc-mov-badge-tipo">${m.tipo || 'Documento'}</span>
                    </div>
                </div>
                <div class="dc-mov-body">
                    <div class="dc-mov-field"><strong>Etapa:</strong> ${escHtml(m.etapa || m.etapaVinculada || '—')}</div>
                    <div class="dc-mov-field"><strong>Folio:</strong> ${escHtml(String(m.folio || '—'))}</div>
                    ${m.plazo ? `<div class="dc-mov-field" style="color:#c0392b;"><strong>Plazo:</strong> ${new Date(m.plazo).toLocaleDateString('es-CL')}</div>` : ''}
                </div>
            </div>`).join('');
        }

        function dcFiltrarMovimientos(causaId) {
            const q = (document.getElementById(`dc-search-mov-${causaId}`)?.value || '').toLowerCase();
            const cua = (document.getElementById(`dc-cuaderno-${causaId}`)?.value || '').toLowerCase();
            const cards = document.querySelectorAll(`#dc-mov-list-${causaId} .dc-mov-card`);
            let visible = 0;
            cards.forEach(card => {
                const matchQ = !q || card.dataset.nombre.includes(q);
                const matchCua = !cua || card.dataset.cuaderno.includes(cua);
                card.style.display = (matchQ && matchCua) ? '' : 'none';
                if (matchQ && matchCua) visible++;
            });
            const cnt = document.getElementById(`dc-mov-count-${causaId}`);
            if (cnt) cnt.textContent = `${visible} movimiento${visible !== 1 ? 's' : ''}`;
        }

        function dcAgregarMovimiento(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const nombre = document.getElementById(`dc-new-mov-nombre-${causaId}`)?.value.trim();
            const tipo = document.getElementById(`dc-new-mov-tipo-${causaId}`)?.value || 'Resolución';
            if (!nombre) { showError('Ingrese el nombre del trámite.'); return; }
            if (!causa.movimientos) causa.movimientos = [];
            causa.movimientos.push({
                id: generarID(), nombre, tipo,
                fecha: new Date().toISOString().split('T')[0],
                cuaderno: 'Principal', etapa: '', folio: '—'
            });
            causa.fechaUltimaActividad = new Date();
            guardarDB();
            registrarEvento(`Movimiento agregado: ${nombre} — ${causa.caratula}`);
            abrirDetalleCausa(causaId);
            setTimeout(() => dcCambiarTab('movimientos', causaId), 50);
        }

        // ════════════════════════════════════════════════════════
        // TAB 2: TAREAS
        // ════════════════════════════════════════════════════════
        function dcRenderTareas(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const el = document.getElementById('dcpanel-tareas');
            if (!el) return;
            if (!causa.tareas) causa.tareas = [];

            const pendientes = causa.tareas.filter(t => !t.done);
            const completadas = causa.tareas.filter(t => t.done);

            const tareaHtml = (t) => `
            <div class="dc-task-item ${t.done ? 'done' : ''}" id="tarea-${t.id}">
                <div class="dc-task-check ${t.done ? 'done' : ''}" onclick="dcToggleTarea(${causaId},'${t.id}')">
                    ${t.done ? '<i class="fas fa-check" style="font-size:0.6rem;"></i>' : ''}
                </div>
                <div style="flex:1; min-width:0;">
                    <div class="dc-task-text">${escHtml(t.texto)}</div>
                    <div class="dc-task-meta">${t.fecha || ''}</div>
                </div>
                <span class="dc-task-prioridad dc-task-p-${t.prioridad || 'media'}">${t.prioridad || 'media'}</span>
                <button class="dc-task-del" onclick="dcEliminarTarea(${causaId},'${t.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>`;

            el.innerHTML = `
            <div class="dc-task-add">
                <input id="dc-task-input-${causaId}" placeholder="Nueva tarea..."
                    onkeydown="if(event.key==='Enter') dcAgregarTarea(${causaId})">
                <select id="dc-task-prio-${causaId}"
                    style="padding:7px 8px; border:1px solid #e4eaf3; border-radius:7px; font-size:0.78rem; background:#f8fafc; font-family:'IBM Plex Sans',sans-serif;">
                    <option value="alta">🔴 Alta</option>
                    <option value="media" selected>🟡 Media</option>
                    <option value="baja">🟢 Baja</option>
                </select>
                <button class="dc-btn primary" onclick="dcAgregarTarea(${causaId})">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>

            ${pendientes.length === 0 && completadas.length === 0
                    ? '<div class="empty-state" style="padding:30px 0; text-align:center; color:#94a3b8;"><i class="fas fa-tasks" style="font-size:1.5rem; display:block; margin-bottom:8px;"></i>Sin tareas. Agrega la primera.</div>'
                    : ''}

            ${pendientes.length ? `
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:8px;">
                    Pendientes (${pendientes.length})
                </div>
                ${pendientes.map(tareaHtml).join('')}` : ''}

            ${completadas.length ? `
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#94a3b8; margin:14px 0 8px;">
                    Completadas (${completadas.length})
                </div>
                ${completadas.map(tareaHtml).join('')}` : ''}`;
        }

        function dcAgregarTarea(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const texto = document.getElementById(`dc-task-input-${causaId}`)?.value.trim();
            if (!texto) return;
            const prio = document.getElementById(`dc-task-prio-${causaId}`)?.value || 'media';
            if (!causa.tareas) causa.tareas = [];
            causa.tareas.push({
                id: 't' + generarID(),
                texto, prioridad: prio, done: false,
                fecha: new Date().toLocaleDateString('es-CL')
            });
            guardarDB();
            dcRenderTareas(causaId);
            // Actualizar badge del tab
            const badge = document.querySelector('#dctab-tareas .dc-tab-badge');
            if (badge) {
                const p = causa.tareas.filter(t => !t.done).length;
                badge.textContent = p > 0 ? `${p}/${causa.tareas.length}` : causa.tareas.length;
            }
        }

        function dcToggleTarea(causaId, tareaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const t = causa.tareas.find(t => t.id === tareaId);
            if (!t) return;
            t.done = !t.done;
            guardarDB();
            dcRenderTareas(causaId);
        }

        function dcEliminarTarea(causaId, tareaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            causa.tareas = causa.tareas.filter(t => t.id !== tareaId);
            guardarDB();
            dcRenderTareas(causaId);
        }

        // ════════════════════════════════════════════════════════
        // TAB 3: DATOS ECONÓMICOS
        // ════════════════════════════════════════════════════════
        function dcRenderEconomico(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            const el = document.getElementById('dcpanel-economico');
            if (!causa || !el) return;

            const hon = causa.honorarios || {};
            const base = hon.montoBase || hon.base || 0;
            const pagos = hon.pagos || [];
            const pagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
            const pend = base - pagado;
            const pct = base > 0 ? Math.round(pagado / base * 100) : 0;
            const cuantia = causa.cuantia || 0;

            el.innerHTML = `
            <div class="dc-econ-grid">
                <div class="dc-econ-kpi blue">
                    <div class="dc-econ-label">Monto Base</div>
                    <div class="dc-econ-val">$${base.toLocaleString('es-CL')}</div>
                </div>
                <div class="dc-econ-kpi green">
                    <div class="dc-econ-label">Cobrado</div>
                    <div class="dc-econ-val" style="color:#0d7a5f;">$${pagado.toLocaleString('es-CL')}</div>
                </div>
                <div class="dc-econ-kpi ${pend > 0 ? 'red' : 'green'}">
                    <div class="dc-econ-label">Pendiente</div>
                    <div class="dc-econ-val" style="color:${pend > 0 ? '#c0392b' : '#0d7a5f'};">$${pend.toLocaleString('es-CL')}</div>
                </div>
                <div class="dc-econ-kpi orange">
                    <div class="dc-econ-label">% Cobrado</div>
                    <div class="dc-econ-val" style="color:#b45309;">${pct}%</div>
                </div>
            </div>

            ${base > 0 ? `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-bottom:14px;">
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">
                    Progreso de cobro
                </div>
                <div style="background:#f1f5f9; border-radius:6px; height:10px; overflow:hidden; margin-bottom:6px;">
                    <div style="height:100%; width:${pct}%; background:linear-gradient(90deg,#1a3a6b,#2563a8); border-radius:6px; transition:width 0.7s;"></div>
                </div>
                <div style="font-size:0.72rem; color:#64748b;">${pct}% cobrado · ${100 - pct}% pendiente</div>
            </div>` : ''}

            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">
                    Historial de pagos ${pagos.length ? `(${pagos.length})` : ''}
                </div>
                <div class="dc-pagos-list">
                    ${pagos.length ? pagos.map(p => `
                        <div class="dc-pago-row">
                            <span style="color:#0f172a; font-weight:600;">${p.concepto || 'Pago'}</span>
                            <span style="color:#64748b; font-size:0.72rem; font-family:'IBM Plex Mono',monospace;">${p.fecha || '—'}</span>
                            <span style="color:#0d7a5f; font-weight:700; font-family:'IBM Plex Mono',monospace;">+$${(p.monto || 0).toLocaleString('es-CL')}</span>
                        </div>`).join('')
                    : '<p style="font-size:0.8rem; color:#94a3b8; text-align:center; padding:12px 0;">Sin pagos registrados.</p>'}
                </div>
            </div>

            ${cuantia ? `
            <div style="margin-top:12px; background:#f8fafc; border:1px solid #e4eaf3; border-radius:8px; padding:12px 16px;">
                <span style="font-size:0.72rem; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.07em;">Cuantía en disputa</span>
                <div style="font-size:1.2rem; font-weight:700; font-family:'IBM Plex Mono',monospace; color:#1a3a6b; margin-top:4px;">$${cuantia.toLocaleString('es-CL')}</div>
            </div>` : ''}`;
        }

        // ════════════════════════════════════════════════════════
        // TAB 4: USUARIOS Y PARTES
        // ════════════════════════════════════════════════════════
        function dcRenderPartes(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            const el = document.getElementById('dcpanel-partes');
            if (!causa || !el) return;
            if (!causa.partes) causa.partes = { demandante: {}, demandado: {}, abogadoContrario: {}, juez: {} };

            const roles = [
                { key: 'demandante', label: 'Demandante', icon: 'fas fa-user', color: '#dbeafe', colorT: '#1a3a6b' },
                { key: 'demandado', label: 'Demandado', icon: 'fas fa-user-slash', color: '#fee2e2', colorT: '#c0392b' },
                { key: 'abogadoContrario', label: 'Abogado Contrario', icon: 'fas fa-gavel', color: '#fef3c7', colorT: '#b45309' },
                { key: 'juez', label: 'Juez / Árbitro', icon: 'fas fa-balance-scale', color: '#d1fae5', colorT: '#0d7a5f' }
            ];

            const iniciales = nombre => (nombre || '?').split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();

            el.innerHTML = `
            <div class="dc-partes-grid">
                ${roles.map(r => {
                const p = causa.partes[r.key] || {};
                const tiene = !!(p.nombre || p.rut || p.email || p.telefono);
                return `
                    <div class="dc-parte-card">
                        <div class="dc-parte-role"><i class="${r.icon}"></i> ${r.label}</div>
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                            <div class="dc-parte-avatar" style="background:${r.color}; color:${r.colorT};">
                                ${tiene ? iniciales(p.nombre) : '<i class="fas fa-plus" style="font-size:0.7rem;"></i>'}
                            </div>
                            <div style="flex:1; min-width:0;">
                                <div class="dc-parte-nombre">${escHtml(p.nombre || '—')}</div>
                                ${p.rut ? `<div class="dc-parte-sub">RUT: ${escHtml(p.rut)}</div>` : ''}
                            </div>
                        </div>
                        ${p.email ? `<div class="dc-parte-sub" style="margin-bottom:2px;"><i class="fas fa-envelope" style="width:12px; color:#94a3b8;"></i> ${escHtml(p.email)}</div>` : ''}
                        ${p.telefono ? `<div class="dc-parte-sub"><i class="fas fa-phone" style="width:12px; color:#94a3b8;"></i> ${escHtml(p.telefono)}</div>` : ''}
                        <button class="dc-parte-edit" onclick="dcEditarParte(${causaId},'${r.key}','${r.label}')">
                            <i class="fas fa-pencil-alt"></i> ${tiene ? 'Editar' : 'Agregar'}
                        </button>
                    </div>`;
            }).join('')}
            </div>

            <!-- Tribunal -->
            <div style="margin-top:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px;">
                <div style="font-size:0.7rem; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:10px;">
                    <i class="fas fa-landmark"></i> Tribunal
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px;">
                    <div>
                        <div class="dc-field-label">Juzgado</div>
                        <div class="dc-field-value">${escHtml(causa.juzgado || '—')}</div>
                    </div>
                    <div>
                        <div class="dc-field-label">Rama</div>
                        <div class="dc-field-value">${escHtml(causa.rama || '—')}</div>
                    </div>
                    <div>
                        <div class="dc-field-label">Secretario</div>
                        <div class="dc-field-value">${escHtml((causa.partes || {}).secretario?.nombre || '—')}</div>
                    </div>
                </div>
                <button class="dc-btn" style="margin-top:10px; font-size:0.76rem;" onclick="dcEditarTribunal(${causaId})">
                    <i class="fas fa-pencil-alt"></i> Editar tribunal
                </button>
            </div>`;
        }

        // ── Formulario inline de edición de parte — SIN prompt() ────────────────────────
        function dcEditarParte(causaId, rolKey, rolLabel) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            if (!causa.partes) causa.partes = {};
            const p = causa.partes[rolKey] || {};

            migAbrir({
                titulo: `<i class="fas fa-user-edit"></i> Editar — ${rolLabel}`,
                btnOk: 'Guardar cambios',
                campos: [
                    { id: 'mig-nombre', label: 'Nombre completo', valor: p.nombre || '', placeholder: 'Ej: Juan Pérez González', requerido: true },
                    { id: 'mig-rut', label: 'RUT', valor: p.rut || '', placeholder: 'Ej: 12.345.678-9', tipo: 'rut' },
                    { id: 'mig-email', label: 'Correo electrónico', valor: p.email || '', placeholder: 'correo@ejemplo.cl', tipo: 'email' },
                    { id: 'mig-tel', label: 'Teléfono', valor: p.telefono || '', placeholder: '+56 9 1234 5678' }
                ],
                onOk: (vals) => {
                    causa.partes[rolKey] = {
                        nombre: vals['mig-nombre'].trim(),
                        rut: vals['mig-rut'] ? formatRUT(vals['mig-rut']) : '',
                        email: vals['mig-email'].trim(),
                        telefono: vals['mig-tel'].trim()
                    };
                    guardarDB();
                    registrarEvento(`Parte actualizada: ${rolLabel} — ${causa.caratula}`);
                    abrirDetalleCausa(causaId);
                    setTimeout(() => dcCambiarTab('partes', causaId), 50);
                }
            });
        }

        function dcEditarTribunal(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            migAbrir({
                titulo: '<i class="fas fa-university"></i> Editar Tribunal',
                btnOk: 'Guardar',
                campos: [
                    { id: 'mig-juzgado', label: 'Nombre del Juzgado o Tribunal', valor: causa.juzgado || '', placeholder: 'Ej: 3° Juzgado Civil de Santiago', requerido: true }
                ],
                onOk: (vals) => {
                    causa.juzgado = vals['mig-juzgado'].trim();
                    guardarDB();
                    abrirDetalleCausa(causaId);
                    setTimeout(() => dcCambiarTab('partes', causaId), 50);
                }
            });
        }

        // Render sección detalle causa (tab)
        function renderDetalleCausa(causaId) {
            const el = document.getElementById('detalle-causa-content');
            if (!causaId) { el.innerHTML = '<div class="empty-state card"><i class="fas fa-gavel"></i><p>Seleccione una causa.</p></div>'; return; }
            abrirDetalleCausa(causaId);
        }

        // ─── 2. marcarEtapa CON UI ────────────────────────────────────────
        function uiMarcarEtapa(causaId, index) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const etapa = causa.etapasProcesales[index];
            if (etapa.completada) {
                if (!confirm('¿Desmarcar esta etapa?')) return;
                etapa.completada = false; etapa.fecha = null;
                recalcularAvance(causa); guardarDB();
                registrarEvento(`Etapa desmarcada: ${etapa.nombre} — ${causa.caratula}`);
                abrirDetalleCausa(causaId); return;
            }
            if (!etapa.documentoAsociado) {
                if (!confirm('Esta etapa no tiene documento asociado. ¿Marcar igualmente?')) return;
            }
            etapa.completada = true;
            etapa.fecha = new Date();
            causa.fechaUltimaActividad = new Date();
            recalcularAvance(causa); guardarDB();
            registrarEvento(`Etapa completada: ${etapa.nombre} — ${causa.caratula}`);
            renderAll();
            abrirDetalleCausa(causaId);
        }

        // ─── 3. Cerrar / Reactivar con UI ────────────────────────────────
        function uiCerrarCausa(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            const pendientes = causa.etapasProcesales?.filter(e => !e.completada).length || 0;
            if (pendientes > 0 && !confirm(`Hay ${pendientes} etapas pendientes. ¿Cerrar igual?`)) return;
            causa.estadoGeneral = 'Finalizada';
            guardarDB(); registrarEvento(`Causa cerrada: ${causa.caratula}`);
            renderAll(); abrirDetalleCausa(causaId);
        }

        function uiReactivarCausa(causaId) {
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            causa.estadoGeneral = 'En tramitación'; causa.instancia = 'Segunda';
            guardarDB(); registrarEvento(`Causa reactivada (2ª instancia): ${causa.caratula}`);
            renderAll(); abrirDetalleCausa(causaId);
        }

        // ─── 4. HONORARIOS REALES ────────────────────────────────────────
        function uiAsignarHonorarios() {
            const causaId = parseInt(document.getElementById('hr-causa-sel').value);
            const monto = parseFloat(document.getElementById('hr-monto').value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }
            asignarHonorarios(causaId, monto);
            const causa = DB.causas.find(c => c.id === causaId);
            registrarEvento(`Honorarios asignados: $${monto.toLocaleString('es-CL')} — ${causa?.caratula}`);
            document.getElementById('hr-monto').value = '';
            renderHonorariosResumen(); renderAll();
        }

        function uiRegistrarPago() {
            const causaId = parseInt(document.getElementById('hr-pago-causa-sel').value);
            const monto = parseFloat(document.getElementById('hr-pago-monto').value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            if (!monto || monto <= 0) { showError('Ingrese un monto válido.'); return; }
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa?.honorarios?.montoBase) { showError('Esta causa no tiene honorarios asignados. Asígnelos primero.'); return; }
            registrarPago(causaId, monto);
            registrarEvento(`Pago registrado: $${monto.toLocaleString('es-CL')} — ${causa?.caratula}`);
            document.getElementById('hr-pago-monto').value = '';
            renderHonorariosResumen(); renderAll();
        }

        function renderHonorariosResumen() {
            const el = document.getElementById('hr-resumen');
            if (!el) return;
            const causasConHon = DB.causas.filter(c => c.honorarios?.montoBase);
            if (!causasConHon.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-wallet"></i><p>Sin honorarios asignados.</p></div>'; return;
            }
            el.innerHTML = causasConHon.map(c => {
                const h = c.honorarios;
                const pagado = h.montoBase - h.saldoPendiente;
                const pct = Math.round((pagado / h.montoBase) * 100);
                return `<div class="card" style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="font-size:0.88rem;">${escHtml(c.caratula)}</strong>
                <span class="badge ${h.saldoPendiente <= 0 ? 'badge-s' : 'badge-w'}">${h.saldoPendiente <= 0 ? 'PAGADO' : 'PENDIENTE'}</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
            <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--t2); margin-top:6px;">
                <span>Base: $${h.montoBase.toLocaleString('es-CL')}</span>
                <span>Pagado: <strong style="color:var(--s);">$${pagado.toLocaleString('es-CL')}</strong></span>
                <span>Pendiente: <strong style="color:var(--d);">$${h.saldoPendiente.toLocaleString('es-CL')}</strong></span>
            </div>
            ${h.pagos?.length ? `<div style="margin-top:10px; border-top:1px solid #f1f5f9; padding-top:8px;">
                ${h.pagos.map(p => `<div class="pago-item"><span>${new Date(p.fecha).toLocaleDateString('es-CL')}</span><span class="pago-monto">+$${p.monto.toLocaleString('es-CL')}</span></div>`).join('')}
            </div>` : ''}
        </div>`;
            }).join('');
        }

        // ─── 5. BÚSQUEDA GLOBAL ──────────────────────────────────────────
        let busqFiltroActual = 'todo';

