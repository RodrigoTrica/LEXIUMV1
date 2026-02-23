        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 17: CLAUDE LEGAL — INTEGRACIÓN IA JURÍDICA COMPLETA
        //
        // FUNCIONALIDADES:
        //   1. Asistente flotante global (LexBot) — chat con contexto completo
        //   2. Análisis IA de causa individual — diagnóstico + riesgo + estrategia
        //   3. Análisis de jurisprudencia — extracción automática de holding
        //   4. Panel IA en Estrategia Pro — análisis profundo con Claude
        //
        // DEPENDENCIAS: 12-ia-providers.js (iaCall, iaGetProvider, iaGetKey)
        // ████████████████████████████████████████████████████████████████████

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 1 — CONTEXTO DEL DESPACHO (se inyecta en todos los prompts)
        // ═══════════════════════════════════════════════════════════════════

        function clBuildContext(opts = {}) {
            const causas   = (DB.causas   || []);
            const clientes = (DB.clientes  || []);
            const juris    = (DB.jurisprudencia || []);
            const tramites = (() => { try { return JSON.parse(localStorage.getItem('APPBOGADO_TRAMITES_V1')) || []; } catch(e) { return []; } })();
            const doctrina = (() => { try { return JSON.parse(localStorage.getItem('APPBOGADO_DOCTRINA_V1'))  || []; } catch(e) { return []; } })();

            const hoy = new Date().toLocaleDateString('es-CL', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

            let ctx = `=== SISTEMA: APPBOGADO — ASISTENTE JURÍDICO LEGAL ===
Fecha actual: ${hoy}
Jurisdicción: Chile (Derecho chileno)
Rol: Eres un asistente jurídico especializado en derecho chileno.
     Apoyas a abogados con análisis procesal, estrategia y redacción jurídica.
     Siempre citas normativa chilena aplicable (Código Civil, CPC, CPP, CT, etc.)
     Eres preciso, conciso y orientado a la acción práctica.

=== DATOS DEL DESPACHO ===
Causas activas: ${causas.filter(c => c.estadoGeneral !== 'Finalizada').length} de ${causas.length} total
Clientes: ${clientes.length}
Jurisprudencia indexada: ${juris.length} sentencias
Trámites administrativos: ${tramites.length}
Doctrina cargada: ${doctrina.length} textos
`;

            if (opts.causas && causas.length) {
                ctx += `\n=== CARTERA DE CAUSAS ===\n`;
                causas.slice(0, 20).forEach(c => {
                    const etapasPend = (c.etapasProcesales||[]).filter(e=>!e.completada).length;
                    const riesgoMax  = Object.values(c.riesgo||{}).includes('Alto') ? '🔴 ALTO'
                                    : Object.values(c.riesgo||{}).includes('Medio') ? '🟡 MEDIO' : '🟢 BAJO';
                    ctx += `- [${c.id}] ${c.caratula} | ${c.rama||'Civil'} | ${c.estadoGeneral||'En tramitación'} | Avance: ${c.porcentajeAvance||0}% | Riesgo: ${riesgoMax} | Etapas pend.: ${etapasPend}\n`;
                });
            }

            if (opts.juris && juris.length) {
                ctx += `\n=== JURISPRUDENCIA INDEXADA ===\n`;
                juris.slice(0, 15).forEach(j => {
                    ctx += `- ${j.tribunal} Rol ${j.rol} | ${j.materia} | Tendencia: ${j.tendencia} | Relevancia: ${j.nivelRelevancia}\n`;
                    if (j.temaCentral) ctx += `  Tema: ${j.temaCentral}\n`;
                });
            }

            if (opts.tramites && tramites.length) {
                ctx += `\n=== TRÁMITES ADMINISTRATIVOS ===\n`;
                tramites.filter(t => !['resuelto','archivado'].includes(t.estado)).slice(0, 10).forEach(t => {
                    const dias = t.fechaLimite ? Math.round((new Date(t.fechaLimite)-new Date())/86400000) : null;
                    ctx += `- ${t.organismo}: ${t.tipo} | ${t.caratula} | Estado: ${t.estado}${dias!==null?` | Vence en: ${dias}d`:''}n`;
                });
            }

            return ctx;
        }

        function clBuildCausaContext(causaId) {
            const causa = DB.causas.find(c => c.id == causaId);
            if (!causa) return '';
            const cliente = DB.clientes.find(c => c.id === causa.clienteId);
            const etapas  = causa.etapasProcesales || [];
            const docs    = causa.documentos || [];
            const tareas  = causa.tareas || [];
            const jurisAsoc = (DB.jurisprudencia||[]).filter(j => j.causaAsociada == causaId || causa.jurisprudenciaIds?.includes(j.id));

            return `
=== CAUSA EN ANÁLISIS ===
Carátula: ${causa.caratula}
RIT/RUC: ${causa.rut || 'N/D'}
Cliente: ${cliente?.nombre || causa.cliente || 'N/D'}
Procedimiento: ${causa.tipoProcedimiento || 'Ordinario'}
Rama: ${causa.rama || 'Civil'}
Instancia: ${causa.instancia || 'Primera'}
Tribunal: ${causa.tribunal || 'N/D'}
Estado: ${causa.estadoGeneral || 'En tramitación'}
Avance: ${causa.porcentajeAvance || 0}%
Fecha inicio: ${causa.fechaIngreso || 'N/D'}
Monto controversia: ${causa.montoControversia ? '$' + Number(causa.montoControversia).toLocaleString('es-CL') : 'N/D'}

Hechos / Objeto del litigio:
${causa.hechos || causa.descripcion || 'No especificados.'}

Estrategia definida:
${causa.estrategia?.descripcion || causa.estrategia || 'No definida.'}

Etapas procesales (${etapas.filter(e=>e.completada).length}/${etapas.length} completadas):
${etapas.map(e => `  [${e.completada?'✓':'○'}] ${e.nombre}${e.fecha?' — '+new Date(e.fecha).toLocaleDateString('es-CL'):''}`).join('\n') || 'Sin etapas.'}

Evaluación de riesgo:
${Object.entries(causa.riesgo||{}).map(([k,v])=>`  ${k}: ${v}`).join('\n') || 'Sin evaluación.'}

Documentos asociados: ${docs.length}
Tareas pendientes: ${tareas.filter(t=>!t.done).length}
Jurisprudencia asociada: ${jurisAsoc.length} sentencias
${jurisAsoc.map(j=>`  - ${j.tribunal} Rol ${j.rol}: ${j.tendencia}`).join('\n')}

Observaciones:
${causa.observaciones || 'Sin observaciones.'}`;
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 2 — ASISTENTE FLOTANTE GLOBAL (LEXBOT)
        // ═══════════════════════════════════════════════════════════════════

        let _clChatHistory = [];   // [{role, content}]
        let _clChatCausaId = null; // Si fue abierto desde una causa
        let _clChatOpen    = false;

        function clInyectarBotonFlotante() {
            if (document.getElementById('cl-fab')) return;
            const fab = document.createElement('button');
            fab.id = 'cl-fab';
            fab.title = 'Abrir Bot AI — Asistente Jurídico IA';
            fab.innerHTML = `<span class="cl-fab-icon">⚖</span><span class="cl-fab-label">Bot AI</span>`;
            fab.onclick = () => clToggleChat();
            document.body.appendChild(fab);
        }

        function clToggleChat(causaId) {
            if (causaId) _clChatCausaId = causaId;
            _clChatOpen = !_clChatOpen;
            const panel = document.getElementById('cl-chat-panel');
            if (_clChatOpen) {
                if (!panel) clCrearChatPanel();
                else document.getElementById('cl-chat-panel').classList.add('open');
                setTimeout(() => document.getElementById('cl-chat-input')?.focus(), 100);
            } else {
                panel?.classList.remove('open');
            }
        }

        // Punto de entrada principal: abre el chat IA desde el detalle de una causa.
        // Si 14-features-v8.js está cargado, delega primero la inyección de contexto
        // en la UI del LexBot legacy (_lexbotCargarContextoUI), luego abre el panel.
        function lexbotAbrirConCausa(causaId) {
            _clChatCausaId = causaId;
            _clChatHistory = [];
            _clChatOpen = false;
            // Inyectar badge + historial en UI legacy si el módulo v8 está disponible
            if (typeof _lexbotCargarContextoUI === 'function') {
                _lexbotCargarContextoUI(causaId);
            }
            clToggleChat(causaId);
        }

        function clCrearChatPanel() {
            const provider = typeof IA_PROVIDERS !== 'undefined' ? IA_PROVIDERS[iaGetProvider()]?.label : 'Claude';
            const hasKey   = typeof iaGetKey === 'function' && iaGetKey(iaGetProvider());
            const causa    = _clChatCausaId ? DB.causas.find(c => c.id == _clChatCausaId) : null;

            const panel = document.createElement('div');
            panel.id    = 'cl-chat-panel';
            panel.classList.add('open');
            panel.innerHTML = `
            <div class="cl-chat-header">
                <div class="cl-chat-header-left">
                    <span class="cl-chat-icon">⚖</span>
                    <div>
                        <div class="cl-chat-title">Bot AI</div>
                        <div class="cl-chat-subtitle">${provider} · Asistente Jurídico IA</div>
                    </div>
                </div>
                <div class="cl-chat-header-actions">
                    <button class="cl-hdr-btn" onclick="clLimpiarChat()" title="Nueva conversación">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button class="cl-hdr-btn" onclick="clToggleChat()" title="Cerrar">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            ${causa ? `
            <div class="cl-causa-chip">
                <i class="fas fa-gavel"></i>
                <span>Contexto: <strong>${causa.caratula.substring(0,45)}${causa.caratula.length>45?'…':''}</strong></span>
                <button onclick="_clChatCausaId=null; clActualizarCausaChip()" title="Quitar contexto">×</button>
            </div>` : `<div id="cl-causa-chip-wrap"></div>`}

            ${!hasKey ? `
            <div class="cl-no-key-warn">
                <i class="fas fa-key"></i>
                <div>
                    <strong>Configura tu API Key</strong><br>
                    Ve a <em>Sistema → Configurar IA</em> y selecciona Claude.<br>
                    <a href="https://console.anthropic.com/settings/keys" target="_blank">Obtener key gratis →</a>
                </div>
            </div>` : ''}

            <div class="cl-chat-messages" id="cl-chat-messages">
                <div class="cl-msg cl-msg-ai">
                    <div class="cl-msg-avatar">⚖</div>
                    <div class="cl-msg-bubble">
                        <p>Hola. Soy <strong>Bot AI</strong>, tu asistente jurídico con acceso completo a tu despacho.</p>
                        ${causa ? `<p>Estoy viendo la causa <strong>${causa.caratula}</strong>. ¿Qué necesitas analizar?</p>` : ''}
                        <p>Puedo ayudarte con:</p>
                        <div class="cl-sugerencias">
                            ${(causa ? [
                                `Analiza el estado procesal de esta causa`,
                                `¿Cuál es el riesgo principal de esta causa?`,
                                `Sugiere la estrategia óptima para este caso`,
                                `¿Qué jurisprudencia aplica aquí?`,
                            ] : [
                                `¿Cuáles son mis causas de mayor riesgo?`,
                                `Resume el estado de todos mis trámites pendientes`,
                                `¿Qué causas tienen plazos próximos a vencer?`,
                                `Analiza mi cartera y sugiere prioridades`,
                            ]).map(s => `<button class="cl-sug-btn" onclick="clEnviarSugerencia('${s.replace(/'/g,"\\'")}')">
                                ${s}
                            </button>`).join('')}
                        </div>
                    </div>
                </div>
            </div>

            <div class="cl-chat-footer">
                <div class="cl-input-wrap">
                    <textarea id="cl-chat-input" class="cl-chat-input"
                        placeholder="Pregunta algo jurídico…"
                        rows="1"
                        onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();clEnviar();}"
                        oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                    <button class="cl-send-btn" onclick="clEnviar()" id="cl-send-btn">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
                <div class="cl-footer-note">Shift+Enter para salto de línea · Respuestas orientativas, no reemplazan asesoría legal</div>
            </div>`;

            document.body.appendChild(panel);
        }

        function clActualizarCausaChip() {
            const wrap = document.getElementById('cl-causa-chip-wrap');
            if (wrap) wrap.innerHTML = '';
        }

        function clLimpiarChat() {
            _clChatHistory = [];
            const msgs = document.getElementById('cl-chat-messages');
            if (msgs) msgs.innerHTML = `
            <div class="cl-msg cl-msg-ai">
                <div class="cl-msg-avatar">⚖</div>
                <div class="cl-msg-bubble"><p>Nueva conversación iniciada. ¿En qué te ayudo?</p></div>
            </div>`;
        }

        function clEnviarSugerencia(texto) {
            const input = document.getElementById('cl-chat-input');
            if (input) input.value = texto;
            clEnviar();
        }

        async function clEnviar() {
            const input = document.getElementById('cl-chat-input');
            const texto = input?.value?.trim();
            if (!texto) return;

            input.value = '';
            input.style.height = 'auto';

            const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
            const key = typeof iaGetKey === 'function' ? iaGetKey(pid) : null;
            if (!key) {
                clAgregarMensaje('ai', '⚠ No hay API Key configurada. Ve a **Sistema → Configurar IA** para agregar tu key de Claude o Gemini.');
                return;
            }

            clAgregarMensaje('user', texto);
            _clChatHistory.push({ role: 'user', content: texto });

            // Indicador de escritura
            const typingId = 'cl-typing-' + Date.now();
            clAgregarMensaje('ai', '<span class="cl-typing"><span></span><span></span><span></span></span>', typingId);

            const btn = document.getElementById('cl-send-btn');
            if (btn) btn.disabled = true;

            try {
                // Construir prompt con contexto
                const hayContextoCausa = !!_clChatCausaId;
                const context = clBuildContext({
                    causas: true,
                    juris: true,
                    tramites: hayContextoCausa ? false : true,
                });
                const causaCtx = hayContextoCausa ? clBuildCausaContext(_clChatCausaId) : '';

                // Historial de conversación (últimos 6 turnos)
                const historialStr = _clChatHistory.slice(-6, -1).map(m =>
                    `${m.role === 'user' ? 'ABOGADO' : 'CLAUDE'}: ${m.content}`
                ).join('\n\n');

                const prompt = `${context}
${causaCtx}

${historialStr ? `=== CONVERSACIÓN PREVIA ===\n${historialStr}\n` : ''}
=== PREGUNTA ACTUAL ===
ABOGADO: ${texto}

CLAUDE LEGAL (responde en español, de forma precisa y práctica, citando normativa chilena cuando sea relevante. Si es análisis de riesgo, usa formato claro con niveles. Si es estrategia, da pasos concretos. Máximo 400 palabras salvo que se pida más detalle):`;

                const respuesta = await iaCall(prompt);

                // Eliminar indicador de escritura
                document.getElementById(typingId)?.remove();

                _clChatHistory.push({ role: 'assistant', content: respuesta });
                clAgregarMensaje('ai', clFormatearRespuesta(respuesta));

            } catch(e) {
                document.getElementById(typingId)?.remove();
                clAgregarMensaje('ai', `⚠ Error: ${e.message}`);
            } finally {
                if (btn) btn.disabled = false;
                input?.focus();
            }
        }

        function clAgregarMensaje(role, html, id) {
            const msgs = document.getElementById('cl-chat-messages');
            if (!msgs) return;
            const div = document.createElement('div');
            if (id) div.id = id;
            div.className = `cl-msg cl-msg-${role}`;
            div.innerHTML = role === 'user'
                ? `<div class="cl-msg-bubble cl-msg-user-bubble">${escHtml ? escHtml(html) : html}</div>`
                : `<div class="cl-msg-avatar">⚖</div><div class="cl-msg-bubble">${html}</div>`;
            msgs.appendChild(div);
            msgs.scrollTop = msgs.scrollHeight;
        }

        function clFormatearRespuesta(texto) {
            // Convertir Markdown básico a HTML
            return texto
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/^### (.+)$/gm, '<h4>$1</h4>')
                .replace(/^## (.+)$/gm, '<h3>$1</h3>')
                .replace(/^# (.+)$/gm, '<h3>$1</h3>')
                .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
                .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
                .replace(/\n\n/g, '</p><p>')
                .replace(/^(?!<[hul])(.+)$/gm, '$1')
                .replace(/^/, '<p>').replace(/$/, '</p>')
                .replace(/<p><\/p>/g, '')
                .replace(/<p>(<[hul])/g, '$1')
                .replace(/(<\/[hul][^>]*>)<\/p>/g, '$1');
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 3 — ANÁLISIS IA DE CAUSA INDIVIDUAL
        // ═══════════════════════════════════════════════════════════════════

        async function clAnalizarCausa(causaId) {
            const causa = DB.causas.find(c => c.id == causaId);
            if (!causa) return;

            const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
            const key = typeof iaGetKey === 'function' ? iaGetKey(pid) : null;
            if (!key) {
                showError('Configura tu API Key en Sistema → Configurar IA');
                return;
            }

            // Crear o actualizar el panel de análisis en el detalle de causa
            let panel = document.getElementById('cl-causa-analysis-panel');
            if (!panel) {
                // Inyectar en el detalle de causa
                const dcLayout = document.querySelector('.dc-layout');
                if (!dcLayout) return;
                panel = document.createElement('div');
                panel.id = 'cl-causa-analysis-panel';
                panel.className = 'cl-analysis-panel';
                dcLayout.insertAdjacentElement('afterend', panel);
            }

            panel.innerHTML = `
            <div class="cl-analysis-header">
                <span>⚖ Análisis Bot AI</span>
                <button onclick="document.getElementById('cl-causa-analysis-panel').remove()" class="cl-hdr-btn">×</button>
            </div>
            <div class="cl-analysis-loading">
                <div class="cl-spinner"></div>
                <span>Analizando causa con ${IA_PROVIDERS[pid]?.label || 'IA'}…</span>
            </div>`;
            panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

            try {
                const ctx = clBuildContext({ juris: true });
                const causaCtx = clBuildCausaContext(causaId);
                const prompt = `${ctx}
${causaCtx}

=== INSTRUCCIÓN ===
Realiza un análisis jurídico completo y accionable de esta causa. Estructura tu respuesta EXACTAMENTE así:

**DIAGNÓSTICO PROCESAL**
[Estado actual, etapas completadas vs. pendientes, observaciones sobre el avance]

**EVALUACIÓN DE RIESGO**
- Riesgo procesal: [Bajo/Medio/Alto] — [razón]
- Riesgo probatorio: [Bajo/Medio/Alto] — [razón]
- Riesgo de prescripción/caducidad: [Bajo/Medio/Alto] — [razón]
- Riesgo económico: [Bajo/Medio/Alto] — [razón]

**FORTALEZAS DE LA POSICIÓN**
[Argumentos sólidos, evidencia favorable, precedentes útiles]

**PUNTOS DÉBILES Y ALERTAS**
[Vulnerabilidades, gaps probatorios, plazos críticos]

**ESTRATEGIA RECOMENDADA**
[Pasos concretos y priorizados, tácticas procesales específicas para esta causa]

**NORMATIVA APLICABLE**
[Artículos específicos del Código Civil, CPC, CT u otras normas chilenas relevantes]

**PRÓXIMAS ACCIONES URGENTES**
1. [Acción concreta — plazo]
2. [Acción concreta — plazo]
3. [Acción concreta — plazo]

Sé específico con los datos de esta causa. No des respuestas genéricas.`;

                const respuesta = await iaCall(prompt);
                panel.innerHTML = `
                <div class="cl-analysis-header">
                    <span>⚖ Análisis Bot AI — <em>${escHtml ? escHtml(causa.caratula.substring(0,50)) : causa.caratula.substring(0,50)}</em></span>
                    <div style="display:flex;gap:8px;">
                        <button onclick="clCopiarAnalisis()" class="cl-hdr-btn" title="Copiar"><i class="fas fa-copy"></i></button>
                        <button onclick="document.getElementById('cl-causa-analysis-panel').remove()" class="cl-hdr-btn">×</button>
                    </div>
                </div>
                <div class="cl-analysis-body" id="cl-analysis-body">
                    ${clFormatearRespuesta(respuesta)}
                </div>
                <div class="cl-analysis-footer">
                    <span><i class="fas fa-info-circle"></i> Análisis generado con ${IA_PROVIDERS[pid]?.label || 'IA'}. Revisar antes de actuar.</span>
                    <button class="cl-btn-reanalizar" onclick="clAnalizarCausa(${causaId})">
                        <i class="fas fa-redo"></i> Re-analizar
                    </button>
                </div>`;

            } catch(e) {
                panel.innerHTML = `
                <div class="cl-analysis-header"><span>⚖ Análisis Bot AI</span>
                    <button onclick="document.getElementById('cl-causa-analysis-panel').remove()" class="cl-hdr-btn">×</button>
                </div>
                <div class="cl-analysis-error"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`;
            }
        }

        function clCopiarAnalisis() {
            const body = document.getElementById('cl-analysis-body');
            if (!body) return;
            navigator.clipboard?.writeText(body.innerText).then(() => {
                if (typeof showInfo === 'function') showInfo('Análisis copiado al portapapeles');
            });
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 4 — ANÁLISIS DE JURISPRUDENCIA CON IA
        // ═══════════════════════════════════════════════════════════════════

        async function clAnalizarJurisprudencia(jurisId) {
            const j = DB.jurisprudencia.find(j => j.id == jurisId);
            if (!j) return;

            const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
            const key = typeof iaGetKey === 'function' ? iaGetKey(pid) : null;
            if (!key) { showError('Configura tu API Key en Sistema → Configurar IA'); return; }

            const modal = document.createElement('div');
            modal.id = 'cl-juris-modal';
            modal.className = 'cl-modal-overlay';
            modal.innerHTML = `
            <div class="cl-modal">
                <div class="cl-modal-header">
                    <span>⚖ Análisis Jurisprudencial</span>
                    <button onclick="document.getElementById('cl-juris-modal').remove()" class="cl-hdr-btn">×</button>
                </div>
                <div class="cl-modal-body">
                    <div class="cl-analysis-loading">
                        <div class="cl-spinner"></div>
                        <span>Analizando sentencia con IA…</span>
                    </div>
                </div>
            </div>`;
            document.body.appendChild(modal);

            try {
                const causasRelevantes = (DB.causas||[]).filter(c =>
                    (c.rama||'').toLowerCase().includes((j.materia||'').toLowerCase().substring(0,5)) ||
                    (c.tipoProcedimiento||'').toLowerCase().includes((j.materia||'').toLowerCase().substring(0,5))
                );

                const prompt = `${clBuildContext({})}

=== SENTENCIA A ANALIZAR ===
Tribunal: ${j.tribunal}
Rol: ${j.rol}
Materia: ${j.materia}
Fecha: ${j.fecha || 'N/D'}
Procedimiento: ${j.procedimiento || 'N/D'}
Tema central: ${j.temaCentral || 'N/D'}
Tendencia: ${j.tendencia}
Nivel de relevancia: ${j.nivelRelevancia}
Palabras clave: ${(j.palabrasClave||[]).join(', ')}

CAUSAS DEL DESPACHO POSIBLEMENTE RELACIONADAS:
${causasRelevantes.map(c => `- ${c.caratula} (${c.rama}, ${c.estadoGeneral})`).join('\n') || 'Ninguna identificada automáticamente.'}

=== INSTRUCCIÓN ===
Analiza esta sentencia y entrega:

**HOLDING PRINCIPAL**
[La regla jurídica que establece el fallo en 2-3 oraciones]

**RATIO DECIDENDI**
[Razonamiento jurídico que sostiene la decisión]

**RELEVANCIA PARA EL DESPACHO**
[Cómo puede afectar o beneficiar las causas activas del abogado]

**CÓMO CITAR ESTE FALLO**
[Forma precisa de citarlo en escritos y recursos]

**APLICACIÓN PRÁCTICA**
[En qué tipo de casos conviene usar este precedente y cómo]

**OBITER DICTA RELEVANTES**
[Comentarios del tribunal con valor orientador]`;

                const resp = await iaCall(prompt);
                modal.querySelector('.cl-modal-body').innerHTML = `
                <div class="cl-juris-meta">
                    <strong>${j.tribunal}</strong> · Rol ${j.rol}<br>
                    <span class="badge ${j.tendencia==='Favorable'?'badge-s':j.tendencia==='Desfavorable'?'badge-d':'badge-a'}">${j.tendencia}</span>
                    <span style="margin-left:8px;font-size:12px;color:var(--text-3);">${j.materia}</span>
                </div>
                <div class="cl-analysis-body">${clFormatearRespuesta(resp)}</div>`;
            } catch(e) {
                modal.querySelector('.cl-modal-body').innerHTML = `<div class="cl-analysis-error"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 5 — ANÁLISIS ESTRATÉGICO CON IA (Estrategia Pro)
        // ═══════════════════════════════════════════════════════════════════

        async function clAnalizarEstrategiaPro(causaId) {
            const causa = DB.causas.find(c => c.id == causaId);
            if (!causa) { showError('Selecciona una causa primero.'); return; }

            const pid = typeof iaGetProvider === 'function' ? iaGetProvider() : 'claude';
            const key = typeof iaGetKey === 'function' ? iaGetKey(pid) : null;
            if (!key) { showError('Configura tu API Key en Sistema → Configurar IA'); return; }

            const contenedor = document.getElementById('analisisEstrategico');
            if (!contenedor) return;

            contenedor.innerHTML = `
            <div class="cl-ep-loading">
                <div class="cl-spinner"></div>
                <span>Claude está elaborando la estrategia legal para esta causa…</span>
            </div>`;

            try {
                const ctx = clBuildContext({ juris: true });
                const causaCtx = clBuildCausaContext(causaId);

                const prompt = `${ctx}
${causaCtx}

=== INSTRUCCIÓN: ANÁLISIS ESTRATÉGICO PROFUNDO ===
Eres un litigante experto en derecho chileno. Analiza esta causa y entrega un plan estratégico completo:

**1. DIAGNÓSTICO ESTRATÉGICO**
[Posición actual del cliente, ventajas comparativas frente a la contraparte]

**2. TEORÍA DEL CASO**
[Narrativa jurídica que el abogado debe sostener en juicio]

**3. MAPA DE RIESGOS**
Señala para cada dimensión: nivel y cómo mitigarlo
- Riesgo procesal:
- Riesgo probatorio:
- Riesgo de prescripción/caducidad:
- Riesgo de condena en costas:
- Riesgo reputacional:

**4. PLAN DE ACCIÓN (90 días)**
Semanas 1-2: [Acciones urgentes]
Semanas 3-6: [Acciones de desarrollo]
Semanas 7-12: [Acciones de consolidación]

**5. ESTRATEGIA PROBATORIA**
[Pruebas clave a obtener, testigos, peritos, documentos]

**6. ARGUMENTOS JURÍDICOS PRINCIPALES**
[Con cita de artículos específicos y jurisprudencia relevante del despacho]

**7. CONTRAARGUMENTOS ESPERADOS Y RESPUESTAS**
[Qué alegará la contraparte y cómo rebatirlo]

**8. ESCENARIOS Y PROBABILIDADES**
- Escenario favorable: [probabilidad estimada + condiciones]
- Escenario neutro (acuerdo): [probabilidad + términos razonables]
- Escenario adverso: [probabilidad + mitigación]

**9. RECOMENDACIÓN FINAL**
[Acción estratégica más importante que el abogado debe ejecutar esta semana]

Sé específico. Cita normativa chilena aplicable. Evita generalidades.`;

                const resp = await iaCall(prompt);

                contenedor.innerHTML = `
                <div class="cl-ep-header">
                    <span>⚖ Análisis Estratégico Bot AI</span>
                    <div style="display:flex;gap:8px;">
                        <button onclick="navigator.clipboard?.writeText(document.getElementById('cl-ep-body').innerText).then(()=>showInfo('Copiado'))" class="cl-hdr-btn" title="Copiar">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="clAnalizarEstrategiaPro(${causaId})" class="cl-hdr-btn" title="Re-analizar">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>
                <div class="cl-ep-body" id="cl-ep-body">${clFormatearRespuesta(resp)}</div>
                <div class="cl-ep-footer">
                    <i class="fas fa-robot"></i> Generado con ${IA_PROVIDERS[pid]?.label||'IA'} ·
                    Revisar con criterio profesional antes de actuar.
                </div>`;

            } catch(e) {
                contenedor.innerHTML = `<div class="cl-analysis-error"><i class="fas fa-exclamation-triangle"></i> ${e.message}</div>`;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 6 — INYECCIÓN EN MÓDULOS EXISTENTES
        // ═══════════════════════════════════════════════════════════════════

        // Inyectar botón "Analizar con Claude" en el detalle de causa
        function clInyectarBotonesCausa() {
            // Patch abrirDetalleCausa para agregar botón IA
            const origAbrir = window.abrirDetalleCausa;
            if (origAbrir && !origAbrir._clPatched) {
                window.abrirDetalleCausa = function(causaId) {
                    origAbrir(causaId);
                    // Agregar botón IA en dc-actions si no existe
                    setTimeout(() => {
                        const actions = document.querySelector('.dc-actions');
                        if (actions && !document.getElementById(`cl-causa-btn-${causaId}`)) {
                            const btn = document.createElement('button');
                            btn.id = `cl-causa-btn-${causaId}`;
                            btn.className = 'dc-btn';
                            btn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;';
                            btn.innerHTML = '<i class="fas fa-brain"></i> Analizar IA';
                            btn.onclick = () => clAnalizarCausa(causaId);
                            // Insertar antes del botón Estrategia
                            const estrategiaBtn = actions.querySelector('.dc-btn.primary');
                            if (estrategiaBtn) actions.insertBefore(btn, estrategiaBtn);
                            else actions.appendChild(btn);
                        }
                    }, 100);
                };
                window.abrirDetalleCausa._clPatched = true;
            }
        }

        // Inyectar botón IA en Estrategia Pro
        function clInyectarBotonEstrategiaPro() {
            const origRender = window.uiRenderEstrategiaPro;
            if (origRender && !origRender._clPatched) {
                window.uiRenderEstrategiaPro = function() {
                    origRender();
                    setTimeout(() => {
                        const contenedor = document.getElementById('analisisEstrategico');
                        if (!contenedor) return;
                        // Solo agregar si no ya tiene contenido IA
                        if (contenedor.querySelector('.cl-ep-header')) return;
                        const causaId = parseInt(document.getElementById('ep-causa-sel')?.value);
                        if (!causaId) return;
                        // Agregar botón IA encima del análisis existente
                        const btnWrap = document.createElement('div');
                        btnWrap.style.cssText = 'margin-bottom:16px;';
                        btnWrap.innerHTML = `<button onclick="clAnalizarEstrategiaPro(${causaId})"
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;">
                            <i class="fas fa-brain"></i> Análisis Estratégico con Bot AI
                        </button>`;
                        contenedor.insertAdjacentElement('beforebegin', btnWrap);
                    }, 150);
                };
                window.uiRenderEstrategiaPro._clPatched = true;
            }
        }

        // Inyectar botón IA en cada sentencia de jurisprudencia
        function clInyectarBotonJuris() {
            const origRender = window.uiRenderJurisprudenciaAvanzada;
            if (origRender && !origRender._clPatched) {
                window.uiRenderJurisprudenciaAvanzada = function() {
                    origRender();
                    // Agregar botón "Analizar con IA" a cada tarjeta
                    setTimeout(() => {
                        document.querySelectorAll('#listaJurisprudencia .card').forEach((card, i) => {
                            if (card.querySelector('.cl-juris-btn')) return;
                            const j = DB.jurisprudencia[i];
                            if (!j) return;
                            const btn = document.createElement('button');
                            btn.className = 'cl-juris-btn btn btn-sm';
                            btn.style.cssText = 'background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;border:none;margin-left:6px;';
                            btn.innerHTML = '<i class="fas fa-brain"></i> Analizar';
                            btn.onclick = (e) => { e.stopPropagation(); clAnalizarJurisprudencia(j.id); };
                            const deleteBtn = card.querySelector('.btn-d');
                            if (deleteBtn) deleteBtn.insertAdjacentElement('beforebegin', btn);
                            else card.appendChild(btn);
                        });
                    }, 100);
                };
                window.uiRenderJurisprudenciaAvanzada._clPatched = true;
            }
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 7 — INICIALIZACIÓN
        // ═══════════════════════════════════════════════════════════════════

        function clLegalInit() {
            clInyectarBotonFlotante();
            clInyectarBotonesCausa();
            clInyectarBotonEstrategiaPro();
            clInyectarBotonJuris();
        }

        // Inicializar cuando el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', clLegalInit);
        } else {
            setTimeout(clLegalInit, 500);
        }
