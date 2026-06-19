// Pega aquí la URL de tu Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_SAUbOtvUZ-XprhqbZKtg7L354FP5C_IjKcodBhNdHvabY1EHDE8Y0EKZZeeHQAuaJw/exec";

// Utilidad para extraer solo la fecha YYYY-MM-DD
const formatFecha = (f) => f ? String(f).substring(0, 10) : "";

// --- 1. FUNCIÓN GET: ESCÁNER PERFIL SST 360° (MÓDULO BUSCADOR) ---
document.getElementById('searchBtn').addEventListener('click', async () => {
    const dni = document.getElementById('searchInput').value.trim();
    if(!dni) return alert("Ingrese un DNI válido");

    const searchResultDiv = document.getElementById('searchResults');
    const profileHeader = document.getElementById('profileHeader');
    const dashboardGrid = document.getElementById('dashboardGrid');
    
    searchResultDiv.classList.remove('hidden');
    dashboardGrid.style.display = 'none';
    profileHeader.className = "card-warning";
    profileHeader.innerHTML = "<p>⏳ Analizando expedientes en la base de datos (SST 360°)...</p>";
    document.querySelectorAll('.dash-status').forEach(el => el.innerHTML = "Cargando...");

    try {
        const noCache = new Date().getTime();
        // 💡 Ahora descargamos TODAS las 11 hojas para tener la foto completa
        const [reqTrabajadores, reqEMO, reqEPP, reqVacunas, reqActos, reqCap, reqInd, reqRisst, reqIperc, reqPtar, reqVig] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EMO&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EPPs&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vacunas&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Actos_Inseguros&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Capacitaciones&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Induccion&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=RISST&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=IPERC&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=PTAR&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vigilancia_Medica&action=readAll&_=${noCache}`)
        ]);

        const [trabajadores, emos, epps, vacunas, actos, caps, inds, rissts, ipercs, ptars, vigs] = await Promise.all([
            reqTrabajadores.json(), reqEMO.json(), reqEPP.json(), reqVacunas.json(), reqActos.json(),
            reqCap.json(), reqInd.json(), reqRisst.json(), reqIperc.json(), reqPtar.json(), reqVig.json()
        ]);

        const trabajador = trabajadores.find(t => t.DNI == dni || t.DNI === parseInt(dni));

        if (!trabajador) {
            profileHeader.className = "card-error";
            profileHeader.innerHTML = `<p>⚠️ Trabajador no encontrado en la base maestra. Verifique el DNI ingresado.</p>`;
            return;
        }

        if (trabajador.Estado === "Inactivo") {
            profileHeader.className = "card-warning";
            profileHeader.innerHTML = `
                <p style="color:#92400e; font-weight:bold;">⚠️ ALERTA: Trabajador INACTIVO</p>
                <p style="margin-bottom:5px;"><strong>DNI:</strong> ${trabajador.DNI}</p>
                <p style="margin-bottom:5px;"><strong>Nombre:</strong> ${trabajador.Nombre_Completo || trabajador.Nombre}</p>
                <p style="color:#92400e;">Este trabajador ha sido marcado como inactivo. Proceda con cuidado.</p>
            `;
            dashboardGrid.style.display = 'none';
            return;
        }

        profileHeader.className = "card-profile";
        profileHeader.innerHTML = `
            <div class="profile-row">
                <div class="profile-field"><div class="profile-label">Trabajador</div><div class="profile-value">${trabajador.Nombre_Completo || trabajador.Nombre}</div></div>
                <div class="profile-field"><div class="profile-label">DNI</div><div class="profile-value">${trabajador.DNI}</div></div>
                <div class="profile-field"><div class="profile-label">Puesto</div><div class="profile-value">${trabajador.Puesto || '—'}</div></div>
                <div class="profile-field"><div class="profile-label">Área</div><div class="profile-value">${trabajador.Area || '—'}</div></div>
            </div>
        `;
        dashboardGrid.style.display = 'grid';

        // Lógicas Originales
        const miEmo = [...emos].reverse().find(e => e.DNI == dni);
        const dashEmo = document.querySelector('#dash-emo .dash-status');
        if (miEmo && miEmo.Fecha_Examen) {
            const fechaExamen = new Date(miEmo.Fecha_Examen);
            const fechaVencimiento = new Date(fechaExamen);
            fechaVencimiento.setFullYear(fechaExamen.getFullYear() + 1);
            fechaVencimiento.setHours(0,0,0,0);
            
            const hoy = new Date();
            hoy.setHours(0,0,0,0);
            
            if (hoy > fechaVencimiento) dashEmo.innerHTML = `<span class="status-red">VENCIDO</span>`;
            else if (miEmo.Aptitud === "Apto con restricciones" || miEmo.Aptitud === "Observado") dashEmo.innerHTML = `<span class="status-yellow">${miEmo.Aptitud}</span>`;
            else dashEmo.innerHTML = `<span class="status-green">Vigente</span>`;
        } else dashEmo.innerHTML = `<span class="status-red">Sin EMO</span>`;

        const miEpp = [...epps].reverse().find(e => e.DNI == dni);
        const dashEpp = document.querySelector('#dash-epp .dash-status');
        if (miEpp) {
            if (miEpp.Casco === "Pendiente" || miEpp.Zapato_Seguridad === "Pendiente" || miEpp.Ropa_Trabajo === "Pendiente") dashEpp.innerHTML = `<span class="status-yellow">Pendientes</span>`;
            else dashEpp.innerHTML = `<span class="status-green">Completos</span>`;
        } else dashEpp.innerHTML = `<span class="status-red">Sin Asignar</span>`;

        const miVacuna = [...vacunas].reverse().find(v => v.DNI == dni);
        const dashVacunas = document.querySelector('#dash-vacunas .dash-status');
        if (miVacuna) {
            if (miVacuna.Tetanos_Estado === "Pendiente" || miVacuna.COVID_Estado === "Pendiente") dashVacunas.innerHTML = `<span class="status-yellow">Incompleto</span>`;
            else dashVacunas.innerHTML = `<span class="status-green">Al Día</span>`;
        } else dashVacunas.innerHTML = `<span class="status-red">Sin Registro</span>`;

        const misActos = actos.filter(a => a.DNI == dni || a.DNI === parseInt(dni));
        const dashActos = document.querySelector('#dash-actos .dash-status');
        if (misActos.length > 0) dashActos.innerHTML = `<span class="status-red">${misActos.length} Infracciones</span>`;
        else dashActos.innerHTML = `<span class="status-green">Limpio (0)</span>`;

        // ─────────────────────────────────────────────────────────────
        // LÓGICAS DE LOS NUEVOS MÓDULOS
        // ─────────────────────────────────────────────────────────────
        
        // Capacitaciones
        const misCaps = caps.filter(c => c.DNI == dni);
        document.querySelector('#dash-cap .dash-status').innerHTML = `<span class="status-green">${misCaps.length} Registros</span>`;

        // Inducción
        const miInd = [...inds].reverse().find(i => i.DNI == dni);
        const dashInd = document.querySelector('#dash-ind .dash-status');
        if (miInd && miInd.Recibio_Induccion === "Recibida") dashInd.innerHTML = `<span class="status-green">Recibida</span>`;
        else dashInd.innerHTML = `<span class="status-red">Pendiente</span>`;

        // RISST
        const miRisst = [...rissts].reverse().find(r => r.DNI == dni);
        const dashRisst = document.querySelector('#dash-risst .dash-status');
        if (miRisst && miRisst.Se_Entrego_RISST === "Si") dashRisst.innerHTML = `<span class="status-green">Entregado</span>`;
        else dashRisst.innerHTML = `<span class="status-red">No Entregado</span>`;

        // Vigilancia Médica
        const miVig = [...vigs].reverse().find(v => v.DNI == dni);
        const dashVig = document.querySelector('#dash-vig .dash-status');
        if (miVig) {
            if (miVig.Requiere_Vigilancia === "Si") dashVig.innerHTML = `<span class="status-yellow">Requiere Vig.</span>`;
            else dashVig.innerHTML = `<span class="status-green">No Requiere</span>`;
        } else dashVig.innerHTML = `<span class="status-red">Sin Registro</span>`;

        // IPERC Continuo
        const misIperc = ipercs.filter(i => i.DNI == dni);
        document.querySelector('#dash-iperc .dash-status').innerHTML = `<span class="status-green">${misIperc.length} Registros</span>`;

        // PTAR
        const misPtar = ptars.filter(p => p.DNI == dni);
        document.querySelector('#dash-ptar .dash-status').innerHTML = `<span class="status-green">${misPtar.length} Permisos</span>`;

        // ─────────────────────────────────────────────────────────────
        // BOTONES INTELIGENTES (Drill-Down) PARA LOS 10 MÓDULOS
        // ─────────────────────────────────────────────────────────────
        const setupCardClick = (cardId, modTarget, inputId, btnId) => {
            const card = document.getElementById(cardId);
            card.style.cursor = "pointer";
            card.title = "Clic para ir al módulo y ver detalles";
            card.onmouseover = () => card.style.transform = "translateY(-4px)";
            card.onmouseout = () => card.style.transform = "translateY(0)";
            card.style.transition = "transform 0.2s ease";

            card.onclick = () => {
                document.querySelector(`.nav-btn[data-target="${modTarget}"]`).click();
                document.getElementById(inputId).value = dni;
                setTimeout(() => document.getElementById(btnId).click(), 150);
            };
        };

        setupCardClick('dash-emo', 'mod-emo', 'emoDni', 'emoBuscarBtn');
        setupCardClick('dash-epp', 'mod-epp', 'eppDni', 'eppBuscarBtn');
        setupCardClick('dash-vacunas', 'mod-vacunas', 'vacDni', 'vacBuscarBtn');
        setupCardClick('dash-actos', 'mod-actos', 'actoDni', 'actoBuscarBtn');
        setupCardClick('dash-cap', 'mod-capacitaciones', 'capDni', 'capBuscarBtn');
        setupCardClick('dash-ind', 'mod-induccion', 'indDni', 'indBuscarBtn');
        setupCardClick('dash-risst', 'mod-risst', 'risstDni', 'risstBuscarBtn');
        setupCardClick('dash-vig', 'mod-vigilancia', 'vigDni', 'vigBuscarBtn');
        setupCardClick('dash-iperc', 'mod-iperc', 'ipercDni', 'ipercBuscarBtn');
        setupCardClick('dash-ptar', 'mod-ptar', 'ptarDni', 'ptarBuscarBtn');

    } catch (error) {
        console.error("Error al cargar 360:", error);
    }
});

// --- 2. FUNCIÓN MAESTRA POST (Guarda o Actualiza) ---
async function guardarRegistro(formId, sheetName, values, actionType = "upsert", reloadBtnId = null) {
    const btnSubmit = document.querySelector(`#${formId} button[type="submit"]`);
    const originalText = btnSubmit.innerText;
    btnSubmit.innerText = "Procesando...";
    btnSubmit.disabled = true;

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", redirect: "follow",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ sheet: sheetName, values: values, actionType: actionType })
        });
        const res = await response.json();
        if (res.result === "success") {
            alert(`¡Éxito! Registro guardado en ${sheetName}.`);
            if(reloadBtnId) setTimeout(() => document.getElementById(reloadBtnId).click(), 500);
        } else alert("Error: " + res.message);
    } catch (error) {
        console.error(error); alert("Falla de conexión.");
    } finally {
        btnSubmit.innerText = originalText; btnSubmit.disabled = false;
    }
}

// --- 3. UTILIDADES DE TABLA, EDICIÓN Y BORRADO GLOBALES ---
async function cargarDatosModulo(sheetName, dni, callback) {
    if(!dni) return callback([]);
    try {
        const noCache = new Date().getTime();
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=${sheetName}&action=readAll&_=${noCache}`);
        const data = await res.json();
        const registros = data.filter(r => r.DNI == dni || r.DNI === parseInt(dni));
        callback(registros);
    } catch(e) { console.error(e); callback([]); }
}

window.borrarRegistroHistorial = async function(sheetName, regEncoded, reloadBtnId) {
    if(!confirm("⚠️ ¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.")) return;
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    try {
        const payload = { sheet: sheetName, actionType: "delete", datosFila: reg };
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.result === "success") {
            alert("✅ Registro eliminado correctamente.");
            document.getElementById(reloadBtnId).click(); 
        } else {
            alert("❌ Error al borrar: " + res.message);
        }
    } catch(e) { console.error(e); alert("Falla de conexión."); }
};

// =========================================================================
//  FUNCIONES DE EDICIÓN PARA TODOS LOS MÓDULOS
// =========================================================================

window.cargarEdicionEPP = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('eppDni').value = reg.DNI; 
    document.getElementById('eppZapato').value = reg.Zapato_Seguridad || "Pendiente";
    document.getElementById('eppFechaZapato').value = formatFecha(reg.Fecha_Zapato);
    document.getElementById('eppRopa').value = reg.Ropa_Trabajo || "Pendiente";
    document.getElementById('eppFechaRopa').value = formatFecha(reg.Fecha_Ropa);
    document.getElementById('eppCasco').value = reg.Casco || "Pendiente";
    document.getElementById('eppFechaCasco').value = formatFecha(reg.Fecha_Casco);
    document.getElementById('eppForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionInduccion = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('indDni').value = reg.DNI; 
    document.getElementById('indEstado').value = reg.Recibio_Induccion || "Pendiente";
    document.getElementById('indFecha').value = formatFecha(reg.Fecha_Induccion);
    document.getElementById('indForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionRISST = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('risstDni').value = reg.DNI; 
    document.getElementById('risstEstado').value = reg.Se_Entrego_RISST || "No";
    document.getElementById('risstFecha').value = formatFecha(reg.Fecha_Entrega);
    document.getElementById('risstForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionEMO = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('emoDni').value = reg.DNI; 
    document.getElementById('emoFecha').value = formatFecha(reg.Fecha_Examen);
    document.getElementById('emoAptitud').value = reg.Aptitud || "";
    document.getElementById('emoDetalleRestriccion').value = reg.Detalle_Restriccion || "";
    document.getElementById('emoAptitud').dispatchEvent(new Event('change'));
    document.getElementById('emoForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionVigilancia = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('vigDni').value = reg.DNI; 
    document.getElementById('vigEnfermedad').value = reg.Enfermedad_Previa || "";
    document.getElementById('vigRequiere').value = reg.Requiere_Vigilancia || "No";
    document.getElementById('vigDetalle').value = reg.Detalle_Vigilancia || "";
    document.getElementById('vigRequiere').dispatchEvent(new Event('change'));
    document.getElementById('vigForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionVacunas = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('vacDni').value = reg.DNI; 
    document.getElementById('vacHepEstado').value = reg.Hepatitis_Estado || "Pendiente";
    document.getElementById('vacHepFecha').value = formatFecha(reg.Hepatitis_Fecha);
    document.getElementById('vacInfEstado').value = reg.Influenza_Estado || "Pendiente";
    document.getElementById('vacInfFecha').value = formatFecha(reg.Influenza_Fecha);
    document.getElementById('vacTetEstado').value = reg.Tetanos_Estado || "Pendiente";
    document.getElementById('vacTetFecha').value = formatFecha(reg.Tetanos_Fecha);
    document.getElementById('vacCovEstado').value = reg.COVID_Estado || "Pendiente";
    document.getElementById('vacCovFecha').value = formatFecha(reg.COVID_Fecha);
    document.getElementById('vacunasForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionActo = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('actoDni').value = reg.DNI; 
    document.getElementById('actoFecha').value = formatFecha(reg.Fecha_Inspeccion);
    document.getElementById('actoCometido').value = reg.Acto_Inseguro_Cometido || "";
    document.getElementById('actoDetalle').value = reg.Detalle || reg.Detalle_Motivo || reg.Motivo || ""; 
    document.getElementById('actoMedida').value = reg.Medida_Correctiva || "";
    const btnSubmit = document.querySelector('#actosForm button[type="submit"]');
    btnSubmit.innerHTML = '💾 Guardar Edición (Nuevo Reg.)';
    btnSubmit.classList.replace('btn-danger', 'btn-primary');
    document.getElementById('actosForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionCapacitacion = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('capDni').value = reg.DNI; 
    document.getElementById('capTema').value = reg.Tema_Capacitacion || "";
    document.getElementById('capFechaProg').value = formatFecha(reg.Fecha_Programada);
    document.getElementById('capAsistio').value = reg.Asistio || "";
    document.getElementById('capFechaAsistencia').value = formatFecha(reg.Fecha_Asistencia);
    const btnSubmit = document.querySelector('#capForm button[type="submit"]');
    btnSubmit.innerHTML = '💾 Guardar Edición (Nuevo Reg.)';
    document.getElementById('capForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionIPERC = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('ipercDni').value = reg.DNI; 
    document.getElementById('ipercFecha').value = formatFecha(reg.Fecha);
    document.getElementById('ipercElaboro').value = reg.Elaboro_IPERC || "";
    const btnSubmit = document.querySelector('#ipercForm button[type="submit"]');
    btnSubmit.innerHTML = '💾 Guardar Edición (Nuevo Reg.)';
    document.getElementById('ipercForm').scrollIntoView({ behavior: 'smooth' });
};

window.cargarEdicionPTAR = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('ptarDni').value = reg.DNI; 
    document.getElementById('ptarFecha').value = formatFecha(reg.Fecha);
    document.getElementById('ptarRequiere').value = reg.Requiere_PTAR || "";
    document.getElementById('ptarElaboro').value = reg.Elaboro_PTAR || "";
    const btnSubmit = document.querySelector('#ptarForm button[type="submit"]');
    btnSubmit.innerHTML = '💾 Guardar Edición (Nuevo Reg.)';
    document.getElementById('ptarForm').scrollIntoView({ behavior: 'smooth' });
};

function renderizarTabla(contenedorId, registros, columnasConfig, actionConfig = null, sheetName = "", reloadBtnId = "") {
    const contenedor = document.getElementById(contenedorId);
    contenedor.classList.remove('hidden');
    
    if(registros.length === 0) {
        contenedor.innerHTML = `<h3>Historial Reciente</h3><div class="empty-msg">No hay registros previos para este DNI.</div>`;
        return;
    }
    
    let html = `<h3>Historial Reciente</h3><div class="table-responsive"><table class="history-table"><thead><tr>`;
    columnasConfig.forEach(col => html += `<th>${col.header}</th>`);
    if (actionConfig) html += `<th>Acciones</th>`;
    html += `</tr></thead><tbody>`;
    
    [...registros].reverse().forEach(reg => {
        html += `<tr>`;
        columnasConfig.forEach(col => {
            let valor = reg[col.key];
            if (col.key === 'Detalle_Motivo' && valor === undefined) valor = reg['Detalle'] || reg['Motivo'] || "";
            if (valor === undefined || valor === null) valor = "";
            html += `<td>${col.isDate && valor ? formatFecha(valor) : valor}</td>`;
        });
        
        if (actionConfig) {
            const regStr = encodeURIComponent(JSON.stringify(reg));
            html += `<td style="white-space: nowrap; display:flex; gap: 6px;">
                        <button type="button" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" 
                                onclick="${actionConfig.functionName}('${regStr}')">✏️ Editar</button>
                        <button type="button" class="btn-danger" style="padding: 4px 8px; font-size: 11px;" 
                                onclick="borrarRegistroHistorial('${sheetName}', '${regStr}', '${reloadBtnId}')">🗑️</button>
                     </td>`;
        }
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

// ==============================================================
//  EVENTOS DE ENVÍO Y BÚSQUEDA DE MÓDULOS (INDEPENDIENTES)
// ==============================================================

document.getElementById('eppBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('eppDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    document.getElementById('eppForm').reset();
    document.getElementById('eppDni').value = dni;
    cargarDatosModulo('EPPs', dni, (registros) => {
        if(registros.length > 0) {
            const e = registros[registros.length - 1]; 
            document.getElementById('eppZapato').value = e.Zapato_Seguridad || "Pendiente";
            document.getElementById('eppFechaZapato').value = formatFecha(e.Fecha_Zapato);
            document.getElementById('eppRopa').value = e.Ropa_Trabajo || "Pendiente";
            document.getElementById('eppFechaRopa').value = formatFecha(e.Fecha_Ropa);
            document.getElementById('eppCasco').value = e.Casco || "Pendiente";
            document.getElementById('eppFechaCasco').value = formatFecha(e.Fecha_Casco);
        } else alert("No hay registros previos. Puede ingresar uno nuevo.");
        
        renderizarTabla('hist-epp', registros, [
            {header: "Zapato", key: "Zapato_Seguridad"},
            {header: "Ropa", key: "Ropa_Trabajo"},
            {header: "Casco", key: "Casco"}
        ], { functionName: "cargarEdicionEPP" }, 'EPPs', 'eppBuscarBtn');
    });
});
document.getElementById('eppForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('eppDni').value, document.getElementById('eppZapato').value, document.getElementById('eppFechaZapato').value, document.getElementById('eppRopa').value, document.getElementById('eppFechaRopa').value, document.getElementById('eppCasco').value, document.getElementById('eppFechaCasco').value ];
    guardarRegistro('eppForm', 'EPPs', v, 'upsert', 'eppBuscarBtn');
});

document.getElementById('capBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('capDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    cargarDatosModulo('Capacitaciones', dni, (registros) => {
        renderizarTabla('hist-cap', registros, [
            {header: "Tema", key: "Tema_Capacitacion"}, {header: "F. Programada", key: "Fecha_Programada", isDate: true},
            {header: "Asistió", key: "Asistio"}, {header: "F. Asistencia", key: "Fecha_Asistencia", isDate: true}
        ], { functionName: "cargarEdicionCapacitacion" }, 'Capacitaciones', 'capBuscarBtn');
    });
});
document.getElementById('capForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('capDni').value, document.getElementById('capTema').value, document.getElementById('capFechaProg').value, document.getElementById('capAsistio').value, document.getElementById('capFechaAsistencia').value || "No asistió" ];
    guardarRegistro('capForm', 'Capacitaciones', v, 'append', 'capBuscarBtn');
    setTimeout(() => { document.querySelector('#capForm button[type="submit"]').innerHTML = '💾 Agregar Capacitación'; }, 1500);
});

document.getElementById('indBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('indDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    document.getElementById('indForm').reset();
    document.getElementById('indDni').value = dni;
    cargarDatosModulo('Induccion', dni, (registros) => {
        if(registros.length > 0) {
            const e = registros[registros.length - 1]; 
            document.getElementById('indEstado').value = e.Recibio_Induccion || "Pendiente";
            document.getElementById('indFecha').value = formatFecha(e.Fecha_Induccion);
        }
        renderizarTabla('hist-ind', registros, [
            {header: "Estado", key: "Recibio_Induccion"},
            {header: "Fecha", key: "Fecha_Induccion", isDate: true}
        ], { functionName: "cargarEdicionInduccion" }, 'Induccion', 'indBuscarBtn');
    });
});
document.getElementById('indForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('indDni').value, document.getElementById('indEstado').value, document.getElementById('indFecha').value || "Pendiente" ];
    guardarRegistro('indForm', 'Induccion', v, 'upsert', 'indBuscarBtn');
});

document.getElementById('risstBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('risstDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    document.getElementById('risstForm').reset();
    document.getElementById('risstDni').value = dni;
    cargarDatosModulo('RISST', dni, (registros) => {
        if(registros.length > 0) {
            const e = registros[registros.length - 1]; 
            document.getElementById('risstEstado').value = e.Se_Entrego_RISST || "No";
            document.getElementById('risstFecha').value = formatFecha(e.Fecha_Entrega);
        }
        renderizarTabla('hist-risst', registros, [
            {header: "Entregado", key: "Se_Entrego_RISST"},
            {header: "Fecha", key: "Fecha_Entrega", isDate: true}
        ], { functionName: "cargarEdicionRISST" }, 'RISST', 'risstBuscarBtn');
    });
});
document.getElementById('risstForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('risstDni').value, document.getElementById('risstEstado').value, document.getElementById('risstFecha').value || "Pendiente" ];
    guardarRegistro('risstForm', 'RISST', v, 'upsert', 'risstBuscarBtn');
});

document.getElementById('emoBuscarBtn').addEventListener('click', async () => {
    const dni = document.getElementById('emoDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    
    document.getElementById('emoForm').reset();
    document.getElementById('emoDni').value = dni;
    document.getElementById('emoRestriccionesContainer').classList.add('hidden');
    document.getElementById('emoTrabajador').value = "Buscando nombre...";

    try {
        const noCache = new Date().getTime();
        const resT = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll&_=${noCache}`);
        const dataT = await resT.json();
        const t = dataT.find(x => x.DNI == dni);
        document.getElementById('emoTrabajador').value = t ? (t.Nombre_Completo || t.Nombre) : "⚠️ Trabajador no encontrado";
    } catch(e) { document.getElementById('emoTrabajador').value = "Desconocido (Falla de red)"; }

    cargarDatosModulo('EMO', dni, (registros) => {
        if(registros.length > 0) {
            const e = registros[registros.length - 1]; 
            document.getElementById('emoFecha').value = formatFecha(e.Fecha_Examen);
            document.getElementById('emoAptitud').value = e.Aptitud || "";
            document.getElementById('emoDetalleRestriccion').value = e.Detalle_Restriccion || "";
            document.getElementById('emoAptitud').dispatchEvent(new Event('change'));
        }
        renderizarTabla('hist-emo', registros, [
            {header: "Fecha Examen", key: "Fecha_Examen", isDate: true},
            {header: "Aptitud", key: "Aptitud"}
        ], { functionName: "cargarEdicionEMO" }, 'EMO', 'emoBuscarBtn');
    });
});
document.getElementById('emoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('emoDni').value, document.getElementById('emoTrabajador').value, document.getElementById('emoFecha').value, document.getElementById('emoAptitud').value, document.getElementById('emoDetalleRestriccion').value || "Ninguna" ];
    guardarRegistro('emoForm', 'EMO', v, 'upsert', 'emoBuscarBtn');
});

document.getElementById('actoBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('actoDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    cargarDatosModulo('Actos_Inseguros', dni, (registros) => {
        renderizarTabla('hist-actos', registros, [
            {header: "Fecha", key: "Fecha_Inspeccion", isDate: true}, 
            {header: "Acto Inseguro", key: "Acto_Inseguro_Cometido"},
            {header: "Detalle / Motivo", key: "Detalle_Motivo"},
            {header: "Correctiva", key: "Medida_Correctiva"}
        ], { functionName: "cargarEdicionActo" }, 'Actos_Inseguros', 'actoBuscarBtn');
    });
});
document.getElementById('actosForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('actoDni').value, document.getElementById('actoFecha').value, document.getElementById('actoCometido').value, document.getElementById('actoDetalle').value, document.getElementById('actoMedida').value ];
    guardarRegistro('actosForm', 'Actos_Inseguros', v, 'append', 'actoBuscarBtn');
    setTimeout(() => {
        const btnSubmit = document.querySelector('#actosForm button[type="submit"]');
        btnSubmit.innerHTML = '⚠️ Registrar Incidencia';
        btnSubmit.classList.replace('btn-primary', 'btn-danger');
        document.getElementById('actosForm').reset();
    }, 1500);
});

document.getElementById('ipercBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('ipercDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    cargarDatosModulo('IPERC', dni, (registros) => {
        renderizarTabla('hist-iperc', registros, [
            {header: "Fecha", key: "Fecha", isDate: true}, {header: "Elaboró", key: "Elaboro_IPERC"}
        ], { functionName: "cargarEdicionIPERC" }, 'IPERC', 'ipercBuscarBtn');
    });
});
document.getElementById('ipercForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('ipercDni').value, document.getElementById('ipercFecha').value, document.getElementById('ipercElaboro').value ];
    guardarRegistro('ipercForm', 'IPERC', v, 'append', 'ipercBuscarBtn');
    setTimeout(() => { document.querySelector('#ipercForm button[type="submit"]').innerHTML = '💾 Guardar Control Diario'; }, 1500);
});

document.getElementById('ptarBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('ptarDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    cargarDatosModulo('PTAR', dni, (registros) => {
        renderizarTabla('hist-ptar', registros, [
            {header: "Fecha", key: "Fecha", isDate: true}, {header: "Requiere", key: "Requiere_PTAR"}, {header: "Elaboró", key: "Elaboro_PTAR"}
        ], { functionName: "cargarEdicionPTAR" }, 'PTAR', 'ptarBuscarBtn');
    });
});
document.getElementById('ptarForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('ptarDni').value, document.getElementById('ptarFecha').value, document.getElementById('ptarRequiere').value, document.getElementById('ptarElaboro').value ];
    guardarRegistro('ptarForm', 'PTAR', v, 'append', 'ptarBuscarBtn');
    setTimeout(() => { document.querySelector('#ptarForm button[type="submit"]').innerHTML = '💾 Guardar PTAR'; }, 1500);
});

document.getElementById('vigBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('vigDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    document.getElementById('vigForm').reset();
    document.getElementById('vigDni').value = dni;
    document.getElementById('vigDetalleContainer').classList.add('hidden');
    cargarDatosModulo('Vigilancia_Medica', dni, (registros) => {
        if(registros.length > 0) {
            const v = registros[registros.length - 1]; 
            document.getElementById('vigEnfermedad').value = v.Enfermedad_Previa || "";
            document.getElementById('vigRequiere').value = v.Requiere_Vigilancia || "No";
            document.getElementById('vigDetalle').value = v.Detalle_Vigilancia || "";
            document.getElementById('vigRequiere').dispatchEvent(new Event('change'));
        }
        renderizarTabla('hist-vig', registros, [
            {header: "Enfermedad", key: "Enfermedad_Previa"},
            {header: "Requiere Vig.", key: "Requiere_Vigilancia"}
        ], { functionName: "cargarEdicionVigilancia" }, 'Vigilancia_Medica', 'vigBuscarBtn');
    });
});
document.getElementById('vigForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('vigDni').value, document.getElementById('vigEnfermedad').value || "Ninguna", document.getElementById('vigRequiere').value, document.getElementById('vigDetalle').value || "N/A" ];
    guardarRegistro('vigForm', 'Vigilancia_Medica', v, 'upsert', 'vigBuscarBtn');
});

document.getElementById('vacBuscarBtn').addEventListener('click', () => {
    const dni = document.getElementById('vacDni').value.trim();
    if(!dni) return alert("Ingrese un DNI");
    document.getElementById('vacunasForm').reset();
    document.getElementById('vacDni').value = dni;
    cargarDatosModulo('Vacunas', dni, (registros) => {
        if(registros.length > 0) {
            const v = registros[registros.length - 1]; 
            document.getElementById('vacHepEstado').value = v.Hepatitis_Estado || "Pendiente";
            document.getElementById('vacHepFecha').value = formatFecha(v.Hepatitis_Fecha);
            document.getElementById('vacInfEstado').value = v.Influenza_Estado || "Pendiente";
            document.getElementById('vacInfFecha').value = formatFecha(v.Influenza_Fecha);
            document.getElementById('vacTetEstado').value = v.Tetanos_Estado || "Pendiente";
            document.getElementById('vacTetFecha').value = formatFecha(v.Tetanos_Fecha);
            document.getElementById('vacCovEstado').value = v.COVID_Estado || "Pendiente";
            document.getElementById('vacCovFecha').value = formatFecha(v.COVID_Fecha);
        }
        renderizarTabla('hist-vacunas', registros, [
            {header: "Hep. B", key: "Hepatitis_Estado"},
            {header: "Influenza", key: "Influenza_Estado"},
            {header: "Tétanos", key: "Tetanos_Estado"},
            {header: "COVID", key: "COVID_Estado"}
        ], { functionName: "cargarEdicionVacunas" }, 'Vacunas', 'vacBuscarBtn');
    });
});
document.getElementById('vacunasForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('vacDni').value, document.getElementById('vacHepEstado').value, document.getElementById('vacHepFecha').value, document.getElementById('vacInfEstado').value, document.getElementById('vacInfFecha').value, document.getElementById('vacTetEstado').value, document.getElementById('vacTetFecha').value, document.getElementById('vacCovEstado').value, document.getElementById('vacCovFecha').value ];
    guardarRegistro('vacunasForm', 'Vacunas', v, 'upsert', 'vacBuscarBtn');
});

document.getElementById('registroForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('regDni').value, document.getElementById('regNombre').value, document.getElementById('regPuesto').value, document.getElementById('regArea').value, document.getElementById('regFecha').value ];
    guardarRegistro('registroForm', 'Trabajadores', v, 'append');
    setTimeout(() => document.getElementById('registroForm').reset(), 1500);
});
// ============================================================== FIN DE SHEETS-API.JS ==============================================================
