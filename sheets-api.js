// Pega aquí la URL de tu Apps Script
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYeAKvqLSi5VBLzKPlt4ICnVjwf5uEvwuL3jNiwbINQ_Ypaz7Cylf2D8F6yfGjGPaUsQ/exec";

// Utilidad para extraer solo la fecha YYYY-MM-DD
const formatFecha = (f) => f ? String(f).substring(0, 10) : "";

// Cargar alertas cuando la página inicia
document.addEventListener('DOMContentLoaded', () => {
    // La función cargarAlertasGlobales() vive en app.js pero puede ser llamada desde aquí
    if (typeof cargarAlertasGlobales === 'function') {
        cargarAlertasGlobales();
    }
});

// --- 1. FUNCIÓN GET: ESCÁNER PERFIL SST 360° ---
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
        const [reqTrabajadores, reqEMO, reqEPP, reqVacunas, reqActos] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EMO&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EPPs&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vacunas&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Actos_Inseguros&action=readAll`)
        ]);

        const [trabajadores, emos, epps, vacunas, actos] = await Promise.all([
            reqTrabajadores.json(), reqEMO.json(), reqEPP.json(), reqVacunas.json(), reqActos.json()
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
        document.getElementById('emoTrabajador').value = trabajador.Nombre_Completo || trabajador.Nombre;
        dashboardGrid.style.display = 'grid';

        const miEmo = emos.find(e => e.DNI == dni);
        const dashEmo = document.querySelector('#dash-emo .dash-status');
        if (miEmo && miEmo.Fecha_Examen) {
            const fechaExamen = new Date(miEmo.Fecha_Examen);
            const fechaHoy = new Date();
            const meses = (fechaHoy.getFullYear() - fechaExamen.getFullYear()) * 12 + (fechaHoy.getMonth() - fechaExamen.getMonth());
            if (meses >= 12) dashEmo.innerHTML = `<span class="status-red">VENCIDO</span>`;
            else if (miEmo.Aptitud === "Apto con restricciones" || miEmo.Aptitud === "Observado") dashEmo.innerHTML = `<span class="status-yellow">${miEmo.Aptitud}</span>`;
            else dashEmo.innerHTML = `<span class="status-green">Vigente</span>`;
        } else dashEmo.innerHTML = `<span class="status-red">Sin EMO</span>`;

        const miEpp = epps.find(e => e.DNI == dni);
        const dashEpp = document.querySelector('#dash-epp .dash-status');
        if (miEpp) {
            if (miEpp.Casco === "Pendiente" || miEpp.Zapato_Seguridad === "Pendiente" || miEpp.Ropa_Trabajo === "Pendiente") dashEpp.innerHTML = `<span class="status-yellow">Pendientes</span>`;
            else dashEpp.innerHTML = `<span class="status-green">Completos</span>`;
        } else dashEpp.innerHTML = `<span class="status-red">Sin Asignar</span>`;

        const miVacuna = vacunas.find(v => v.DNI == dni);
        const dashVacunas = document.querySelector('#dash-vacunas .dash-status');
        if (miVacuna) {
            if (miVacuna.Tetanos_Estado === "Pendiente" || miVacuna.COVID_Estado === "Pendiente") dashVacunas.innerHTML = `<span class="status-yellow">Incompleto</span>`;
            else dashVacunas.innerHTML = `<span class="status-green">Al Día</span>`;
        } else dashVacunas.innerHTML = `<span class="status-red">Sin Registro</span>`;

        const misActos = actos.filter(a => a.DNI == dni || a.DNI === parseInt(dni));
        const dashActos = document.querySelector('#dash-actos .dash-status');
        if (misActos.length > 0) dashActos.innerHTML = `<span class="status-red">${misActos.length} Infracciones</span>`;
        else dashActos.innerHTML = `<span class="status-green">Limpio (0)</span>`;

    } catch (error) {
        console.error("Error al cargar 360:", error);
    }
});

// --- 2. FUNCIÓN MAESTRA POST (Guarda o Actualiza) ---
async function guardarRegistro(formId, sheetName, values, actionType = "upsert") {
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
            const dni = document.getElementById('searchInput').value.trim();
            if(actionType === "append" && dni) {
                document.querySelector(`[data-target="${document.querySelector('.module.active').id}"]`).click();
            }
        } else alert("Error: " + res.message);
    } catch (error) {
        console.error(error); alert("Falla de conexión.");
    } finally {
        btnSubmit.innerText = originalText; btnSubmit.disabled = false;
    }
}

// --- 3. UTILIDADES DE TABLA E HISTORIAL ---
async function cargarDatosModulo(sheetName, callback) {
    const dni = document.getElementById('searchInput').value.trim();
    if(!dni) return callback([]);
    try {
        const res = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=${sheetName}&action=readAll`);
        const data = await res.json();
        const registros = data.filter(r => r.DNI == dni || r.DNI === parseInt(dni));
        callback(registros);
    } catch(e) { console.error(e); callback([]); }
}

// Cargar acto inseguro al formulario
window.cargarEdicionActo = function(regEncoded) {
    const reg = JSON.parse(decodeURIComponent(regEncoded));
    document.getElementById('actoFecha').value = formatFecha(reg.Fecha_Inspeccion);
    document.getElementById('actoCometido').value = reg.Acto_Inseguro_Cometido || "";
    // Soporta múltiples nombres posibles de columna de Excel para evitar el 'undefined'
    document.getElementById('actoDetalle').value = reg.Detalle || reg.Detalle_Motivo || reg.Motivo || ""; 
    document.getElementById('actoMedida').value = reg.Medida_Correctiva || "";

    const btnSubmit = document.querySelector('#actosForm button[type="submit"]');
    btnSubmit.innerHTML = '💾 Guardar Edición (Creará nuevo registro)';
    btnSubmit.classList.replace('btn-danger', 'btn-primary');
    document.getElementById('actosForm').scrollIntoView({ behavior: 'smooth' });
};

// Borrar registro (Envía orden 'delete' a Apps Script)
window.borrarRegistroHistorial = async function(sheetName, regEncoded) {
    if(!confirm("⚠️ ¿Estás completamente seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.")) {
        return;
    }
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
            document.querySelector(`[data-target="${document.querySelector('.module.active').id}"]`).click();
        } else {
            alert("❌ Error al borrar: " + res.message);
        }
    } catch(e) { console.error(e); alert("Falla de conexión con la base de datos."); }
};

// Renderizar tabla con soporte anti-undefined y botones Delete/Edit
function renderizarTabla(contenedorId, registros, columnasConfig, actionConfig = null, sheetName = "") {
    const contenedor = document.getElementById(contenedorId);
    contenedor.classList.remove('hidden');
    
    if(registros.length === 0) {
        contenedor.innerHTML = `<h3>Historial Reciente</h3><div class="empty-msg">No hay registros previos para este trabajador.</div>`;
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
            // Respaldo por si la columna en Excel se llama distinto
            if (col.key === 'Detalle_Motivo' && valor === undefined) {
                valor = reg['Detalle'] || reg['Motivo'] || "";
            }
            if (valor === undefined || valor === null) valor = "";
            html += `<td>${col.isDate && valor ? formatFecha(valor) : valor}</td>`;
        });
        
        if (actionConfig) {
            const regStr = encodeURIComponent(JSON.stringify(reg));
            html += `<td style="white-space: nowrap; display:flex; gap: 6px;">
                        <button type="button" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;" 
                                onclick="${actionConfig.functionName}('${regStr}')">✏️ Editar</button>
                        <button type="button" class="btn-danger" style="padding: 4px 8px; font-size: 11px;" 
                                onclick="borrarRegistroHistorial('${sheetName}', '${regStr}')">🗑️</button>
                     </td>`;
        }
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

// ==============================================================
//  EVENTOS DE ENVÍO DE FORMULARIOS (POST)
// ==============================================================

document.getElementById('registroForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('regDni').value, document.getElementById('regNombre').value, document.getElementById('regPuesto').value, document.getElementById('regArea').value, document.getElementById('regFecha').value ];
    guardarRegistro('registroForm', 'Trabajadores', v, 'append');
});

document.getElementById('eppForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('eppZapato').value, document.getElementById('eppFechaZapato').value, document.getElementById('eppRopa').value, document.getElementById('eppFechaRopa').value, document.getElementById('eppCasco').value, document.getElementById('eppFechaCasco').value ];
    guardarRegistro('eppForm', 'EPPs', v, 'upsert');
});

document.getElementById('capForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('capTema').value, document.getElementById('capFechaProg').value, document.getElementById('capAsistio').value, document.getElementById('capFechaAsistencia').value || "No asistió" ];
    guardarRegistro('capForm', 'Capacitaciones', v, 'append');
});

document.getElementById('indForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('indEstado').value, document.getElementById('indFecha').value || "Pendiente" ];
    guardarRegistro('indForm', 'Induccion', v, 'upsert');
});

document.getElementById('risstForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('risstEstado').value, document.getElementById('risstFecha').value || "Pendiente" ];
    guardarRegistro('risstForm', 'RISST', v, 'upsert');
});

document.getElementById('emoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('emoTrabajador').value, document.getElementById('emoFecha').value, document.getElementById('emoAptitud').value, document.getElementById('emoDetalleRestriccion').value || "Ninguna" ];
    guardarRegistro('emoForm', 'EMO', v, 'upsert');
});

document.getElementById('actosForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('actoFecha').value, document.getElementById('actoCometido').value, document.getElementById('actoDetalle').value, document.getElementById('actoMedida').value ];
    guardarRegistro('actosForm', 'Actos_Inseguros', v, 'append');
    
    // Restaurar el botón si estábamos en modo "edición"
    setTimeout(() => {
        const btnSubmit = document.querySelector('#actosForm button[type="submit"]');
        btnSubmit.innerHTML = '⚠️ Registrar Incidencia';
        btnSubmit.classList.replace('btn-primary', 'btn-danger');
        document.getElementById('actosForm').reset();
    }, 1500);
});

document.getElementById('ipercForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('ipercFecha').value, document.getElementById('ipercElaboro').value ];
    guardarRegistro('ipercForm', 'IPERC', v, 'append');
});

document.getElementById('ptarForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('ptarFecha').value, document.getElementById('ptarRequiere').value, document.getElementById('ptarElaboro').value ];
    guardarRegistro('ptarForm', 'PTAR', v, 'append');
});

document.getElementById('vigForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('vigEnfermedad').value || "Ninguna", document.getElementById('vigRequiere').value, document.getElementById('vigDetalle').value || "N/A" ];
    guardarRegistro('vigForm', 'Vigilancia_Medica', v, 'upsert');
});

document.getElementById('vacunasForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = [ document.getElementById('searchInput').value, document.getElementById('vacHepEstado').value, document.getElementById('vacHepFecha').value, document.getElementById('vacInfEstado').value, document.getElementById('vacInfFecha').value, document.getElementById('vacTetEstado').value, document.getElementById('vacTetFecha').value, document.getElementById('vacCovEstado').value, document.getElementById('vacCovFecha').value ];
    guardarRegistro('vacunasForm', 'Vacunas', v, 'upsert');
});

// ==============================================================
//  EVENTOS DE AUTO-LLENADO Y TABLAS AL ENTRAR A UN MÓDULO
// ==============================================================

document.querySelector('[data-target="mod-epp"]').addEventListener('click', () => {
    document.getElementById('eppForm').reset();
    cargarDatosModulo('EPPs', (registros) => {
        if(registros.length > 0) {
            const e = registros[0];
            document.getElementById('eppZapato').value = e.Zapato_Seguridad || "Pendiente";
            document.getElementById('eppFechaZapato').value = formatFecha(e.Fecha_Zapato);
            document.getElementById('eppRopa').value = e.Ropa_Trabajo || "Pendiente";
            document.getElementById('eppFechaRopa').value = formatFecha(e.Fecha_Ropa);
            document.getElementById('eppCasco').value = e.Casco || "Pendiente";
            document.getElementById('eppFechaCasco').value = formatFecha(e.Fecha_Casco);
        }
    });
});

document.querySelector('[data-target="mod-capacitaciones"]').addEventListener('click', () => {
    cargarDatosModulo('Capacitaciones', (registros) => {
        renderizarTabla('hist-cap', registros, [
            {header: "Tema", key: "Tema_Capacitacion"}, {header: "F. Programada", key: "Fecha_Programada", isDate: true},
            {header: "Asistió", key: "Asistio"}, {header: "F. Asistencia", key: "Fecha_Asistencia", isDate: true}
        ]);
    });
});

document.querySelector('[data-target="mod-induccion"]').addEventListener('click', () => {
    document.getElementById('indForm').reset();
    cargarDatosModulo('Induccion', (registros) => {
        if(registros.length > 0) {
            document.getElementById('indEstado').value = registros[0].Recibio_Induccion || "Pendiente";
            document.getElementById('indFecha').value = formatFecha(registros[0].Fecha_Induccion);
        }
    });
});

document.querySelector('[data-target="mod-risst"]').addEventListener('click', () => {
    document.getElementById('risstForm').reset();
    cargarDatosModulo('RISST', (registros) => {
        if(registros.length > 0) {
            document.getElementById('risstEstado').value = registros[0].Se_Entrego_RISST || "No";
            document.getElementById('risstFecha').value = formatFecha(registros[0].Fecha_Entrega);
        }
    });
});

document.querySelector('[data-target="mod-emo"]').addEventListener('click', () => {
    document.getElementById('emoForm').reset();
    document.getElementById('emoRestriccionesContainer').classList.add('hidden');
    cargarDatosModulo('EMO', (registros) => {
        if(registros.length > 0) {
            const e = registros[0];
            document.getElementById('emoFecha').value = formatFecha(e.Fecha_Examen);
            document.getElementById('emoAptitud').value = e.Aptitud || "";
            document.getElementById('emoDetalleRestriccion').value = e.Detalle_Restriccion || "";
            document.getElementById('emoAptitud').dispatchEvent(new Event('change'));
        }
    });
});

// Mod 6: Actos Inseguros (Con configuración de Editar y Borrar)
document.querySelector('[data-target="mod-actos"]').addEventListener('click', () => {
    cargarDatosModulo('Actos_Inseguros', (registros) => {
        renderizarTabla('hist-actos', registros, [
            {header: "Fecha", key: "Fecha_Inspeccion", isDate: true}, 
            {header: "Acto Inseguro", key: "Acto_Inseguro_Cometido"},
            {header: "Detalle / Motivo", key: "Detalle_Motivo"},
            {header: "Correctiva", key: "Medida_Correctiva"}
        ], 
        { functionName: "cargarEdicionActo" }, 
        'Actos_Inseguros');
    });
});

document.querySelector('[data-target="mod-iperc"]').addEventListener('click', () => {
    cargarDatosModulo('IPERC', (registros) => {
        renderizarTabla('hist-iperc', registros, [
            {header: "Fecha", key: "Fecha", isDate: true}, {header: "Elaboró", key: "Elaboro_IPERC"}
        ]);
    });
});

document.querySelector('[data-target="mod-ptar"]').addEventListener('click', () => {
    cargarDatosModulo('PTAR', (registros) => {
        renderizarTabla('hist-ptar', registros, [
            {header: "Fecha", key: "Fecha", isDate: true}, {header: "Requiere", key: "Requiere_PTAR"}, {header: "Elaboró", key: "Elaboro_PTAR"}
        ]);
    });
});

document.querySelector('[data-target="mod-vigilancia"]').addEventListener('click', () => {
    document.getElementById('vigForm').reset();
    document.getElementById('vigDetalleContainer').classList.add('hidden');
    cargarDatosModulo('Vigilancia_Medica', (registros) => {
        if(registros.length > 0) {
            const v = registros[0];
            document.getElementById('vigEnfermedad').value = v.Enfermedad_Previa || "";
            document.getElementById('vigRequiere').value = v.Requiere_Vigilancia || "No";
            document.getElementById('vigDetalle').value = v.Detalle_Vigilancia || "";
            document.getElementById('vigRequiere').dispatchEvent(new Event('change'));
        }
    });
});

document.querySelector('[data-target="mod-vacunas"]').addEventListener('click', () => {
    document.getElementById('vacunasForm').reset();
    cargarDatosModulo('Vacunas', (registros) => {
        if(registros.length > 0) {
            const v = registros[0];
            document.getElementById('vacHepEstado').value = v.Hepatitis_Estado || "Pendiente";
            document.getElementById('vacHepFecha').value = formatFecha(v.Hepatitis_Fecha);
            document.getElementById('vacInfEstado').value = v.Influenza_Estado || "Pendiente";
            document.getElementById('vacInfFecha').value = formatFecha(v.Influenza_Fecha);
            document.getElementById('vacTetEstado').value = v.Tetanos_Estado || "Pendiente";
            document.getElementById('vacTetFecha').value = formatFecha(v.Tetanos_Fecha);
            document.getElementById('vacCovEstado').value = v.COVID_Estado || "Pendiente";
            document.getElementById('vacCovFecha').value = formatFecha(v.COVID_Fecha);
        }
    });
});
// ============================================================== FIN DE SHEETS-API.JS ==============================================================