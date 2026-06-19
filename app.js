// ==============================================================
//  FUNCIONES GLOBALES (FUERA DE DOMContentLoaded)
// ==============================================================

// ==============================================================
//  LÓGICA DE ALERTAS GLOBALES DEL SISTEMA (Desplegables)
// ==============================================================
async function cargarAlertasGlobales() {
    const alertasContainer = document.getElementById('alertasContainer');
    const noAlertsMsg = document.getElementById('noAlertsMsg');

    const secEmoVencidos = document.getElementById('sec-alertas-emo-vencidos');
    const secEmoFaltantes = document.getElementById('sec-alertas-emo-faltantes');
    const secEpp = document.getElementById('sec-alertas-epp');
    const secVacunas = document.getElementById('sec-alertas-vacunas');
    const secActos = document.getElementById('sec-alertas-actos');

    const listEmoVencidos = document.getElementById('list-alertas-emo-vencidos');
    const listEmoFaltantes = document.getElementById('list-alertas-emo-faltantes');
    const listEpp = document.getElementById('list-alertas-epp');
    const listVacunas = document.getElementById('list-alertas-vacunas');
    const listActos = document.getElementById('list-alertas-actos');
    
    try {
        const noCache = new Date().getTime();

        const [reqTrabajadores, reqEMO, reqEPP, reqVacunas, reqActos] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EMO&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EPPs&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vacunas&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Actos_Inseguros&action=readAll&_=${noCache}`)
        ]);

        const [trabajadores, emos, epps, vacunas, actos] = await Promise.all([
            reqTrabajadores.json(), reqEMO.json(), reqEPP.json(), reqVacunas.json(), reqActos.json()
        ]);

        const trabajadoresActivos = trabajadores.filter(t => t.Estado !== 'Inactivo');
        
        const alertas = { emoVencidos: [], emoFaltantes: [], epp: [], vacunas: [], actos: [] };
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // 1. EMOs
        trabajadoresActivos.forEach(t => {
            const miEMO = [...emos].reverse().find(e => e.DNI == t.DNI);
            if (!miEMO || !miEMO.Fecha_Examen || miEMO.Fecha_Examen === "") {
                alertas.emoFaltantes.push({ titulo: `👤 ${t.Nombre_Completo || t.Nombre}`, detalle: `Sin Examen Médico registrado.`, dni: t.DNI, prioridad: 'warning' });
            } else {
                const fechaExamen = new Date(miEMO.Fecha_Examen);
                const fechaVencimiento = new Date(fechaExamen);
                fechaVencimiento.setFullYear(fechaExamen.getFullYear() + 1);
                fechaVencimiento.setHours(0, 0, 0, 0);
                const diasRestantes = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

                if (diasRestantes <= 3) {
                    if (diasRestantes < 0) alertas.emoVencidos.push({ titulo: `📋 ${t.Nombre_Completo || t.Nombre}`, detalle: `Venció hace ${Math.abs(diasRestantes)} días (${formatFecha(fechaVencimiento)})`, dni: t.DNI, prioridad: 'critica' });
                    else if (diasRestantes === 0) alertas.emoVencidos.push({ titulo: `📋 ${t.Nombre_Completo || t.Nombre}`, detalle: `VENCE HOY - Renovación inmediata`, dni: t.DNI, prioridad: 'critica' });
                    else alertas.emoVencidos.push({ titulo: `📋 ${t.Nombre_Completo || t.Nombre}`, detalle: `Por vencer en ${diasRestantes} días`, dni: t.DNI, prioridad: 'warning' });
                }
            }
        });

        // 2. EPP
        trabajadoresActivos.forEach(t => {
            const miEPP = [...epps].reverse().find(e => e.DNI == t.DNI);
            if (!miEPP || miEPP.Casco === 'Pendiente' || miEPP.Zapato_Seguridad === 'Pendiente' || miEPP.Ropa_Trabajo === 'Pendiente') {
                alertas.epp.push({ titulo: `🛡️ ${t.Nombre_Completo || t.Nombre}`, detalle: 'Tiene EPP sin asignar o incompletos', dni: t.DNI, prioridad: 'warning' });
            }
        });

        // 3. Vacunas
        trabajadoresActivos.forEach(t => {
            const miVacuna = [...vacunas].reverse().find(v => v.DNI == t.DNI);
            if (!miVacuna || miVacuna.Tetanos_Estado === 'Pendiente' || miVacuna.COVID_Estado === 'Pendiente') {
                alertas.vacunas.push({ titulo: `💉 ${t.Nombre_Completo || t.Nombre}`, detalle: 'Faltan vacunas en su esquema', dni: t.DNI, prioridad: 'warning' });
            }
        });

        // 4. Actos Inseguros
        const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
        const actosRecientes = actos.filter(a => new Date(a.Fecha_Inspeccion) > hace7dias);
        actosRecientes.forEach(acto => {
            const trabajador = trabajadoresActivos.find(t => t.DNI == acto.DNI);
            const nombreTrabajador = trabajador ? (trabajador.Nombre_Completo || trabajador.Nombre) : "Desconocido";
            alertas.actos.push({ titulo: `⚠️ ${nombreTrabajador}`, detalle: `${formatFecha(acto.Fecha_Inspeccion)}: ${acto.Acto_Inseguro_Cometido || 'Infracción'}`, dni: acto.DNI, prioridad: 'critica' });
        });

        // --- Función auxiliar actualizada para los Acordeones ---
        const renderSection = (listElement, sectionElement, dataArray, badgeId) => {
            const badge = document.getElementById(badgeId);
            
            if (dataArray.length === 0) {
                sectionElement.classList.add('hidden'); 
                sectionElement.removeAttribute('open');
            } else {
                sectionElement.classList.remove('hidden'); 
                if(badge) badge.innerText = dataArray.length; // Inyecta el número en la burbujita
                
                listElement.innerHTML = '';
                dataArray.forEach(alerta => {
                    const alertaEl = document.createElement('div');
                    alertaEl.className = `alerta-item ${alerta.prioridad === 'critica' ? '' : 'warning'}`;
                    alertaEl.innerHTML = `
                        <div class="alerta-content">
                            <div class="alerta-titulo">${alerta.titulo}</div>
                            <div class="alerta-detalle">${alerta.detalle}</div>
                        </div>
                        ${alerta.prioridad === 'critica' ? '<div class="alerta-badge">URGENTE</div>' : ''}
                    `;
                    if (alerta.dni) {
                        alertaEl.addEventListener('click', () => {
                            document.querySelector('.nav-btn[data-target="mod-search"]').click();
                            document.getElementById('searchInput').value = alerta.dni;
                            document.getElementById('searchBtn').click();
                        });
                    }
                    listElement.appendChild(alertaEl);
                });
            }
        };

        renderSection(listEmoVencidos, secEmoVencidos, alertas.emoVencidos, 'badge-emo-vencidos');
        renderSection(listEmoFaltantes, secEmoFaltantes, alertas.emoFaltantes, 'badge-emo-faltantes');
        renderSection(listEpp, secEpp, alertas.epp, 'badge-epp');
        renderSection(listVacunas, secVacunas, alertas.vacunas, 'badge-vacunas');
        renderSection(listActos, secActos, alertas.actos, 'badge-actos');

        const totalAlertas = alertas.emoVencidos.length + alertas.emoFaltantes.length + alertas.epp.length + alertas.vacunas.length + alertas.actos.length;
        if (totalAlertas === 0) {
            alertasContainer.classList.add('hidden');
            if(noAlertsMsg) noAlertsMsg.classList.remove('hidden');
        } else {
            alertasContainer.classList.remove('hidden');
            if(noAlertsMsg) noAlertsMsg.classList.add('hidden');
        }

    } catch (error) {
        console.error("Error cargando alertas:", error);
    }
}

// ==============================================================
//  INICIALIZACIÓN DE EVENT LISTENERS (CUANDO DOM ESTÁ LISTO)
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    // --- Lógica del Menú Lateral ---
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
            
            const buttonClicked = e.target.closest('.nav-btn');
            buttonClicked.classList.add('active');
            
            const targetId = buttonClicked.getAttribute('data-target');
            const targetModule = document.getElementById(targetId);
            if (targetModule) {
                targetModule.classList.add('active');
            }

            if (targetId === 'mod-estadisticas') cargarEstadisticas();
            if (targetId === 'mod-alertas') cargarAlertasGlobales();
        });
    });

    // --- Lógica Condicional: Módulo 5 (EMO) ---
    const emoAptitud = document.getElementById('emoAptitud');
    const emoRestriccionesContainer = document.getElementById('emoRestriccionesContainer');
    const emoDetalleRestriccion = document.getElementById('emoDetalleRestriccion');

    if (emoAptitud) {
        emoAptitud.addEventListener('change', (e) => {
            const valor = e.target.value;
            if (valor === 'Apto con restricciones' || valor === 'Observado' || valor === 'Con Observaciones') {
                emoRestriccionesContainer.classList.remove('hidden');
                emoDetalleRestriccion.setAttribute('required', 'true');
                
                const label = emoRestriccionesContainer.querySelector('label');
                if (valor === 'Observado' || valor === 'Con Observaciones') {
                    label.innerText = 'Detalle de Observaciones';
                    emoDetalleRestriccion.placeholder = 'Describa las observaciones médicas pendientes...';
                } else {
                    label.innerText = 'Detalle de Restricciones';
                    emoDetalleRestriccion.placeholder = 'Describa las restricciones médicas...';
                }
            } else {
                emoRestriccionesContainer.classList.add('hidden');
                emoDetalleRestriccion.removeAttribute('required');
                emoDetalleRestriccion.value = ''; 
            }
        });
    }

    // --- Lógica Condicional: Módulo 9 (Vigilancia Médica) ---
    const vigRequiere = document.getElementById('vigRequiere');
    const vigDetalleContainer = document.getElementById('vigDetalleContainer');
    const vigDetalle = document.getElementById('vigDetalle');

    if (vigRequiere) {
        vigRequiere.addEventListener('change', (e) => {
            if (e.target.value === 'Si') {
                vigDetalleContainer.classList.remove('hidden');
                vigDetalle.setAttribute('required', 'true');
            } else {
                vigDetalleContainer.classList.add('hidden');
                vigDetalle.removeAttribute('required');
                vigDetalle.value = '';
            }
        });
    }

    // --- Lógica de Edición de Trabajadores ---
    const editCargarBtn = document.getElementById('editCargarBtn');
    if (editCargarBtn) {
        editCargarBtn.addEventListener('click', async () => {
            const dni = document.getElementById('editDni').value.trim();
            if (!dni) return alert("Ingrese un DNI válido");

            try {
                const noCache = new Date().getTime();
                const res = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll&_=${noCache}`);
                const trabajadores = await res.json();
                const trabajador = trabajadores.find(t => t.DNI == dni || t.DNI === parseInt(dni));

                if (!trabajador) {
                    return alert("Trabajador no encontrado en la base de datos.");
                }

                document.getElementById('editNombre').value = trabajador.Nombre_Completo || trabajador.Nombre || '';
                document.getElementById('editPuesto').value = trabajador.Puesto || '';
                document.getElementById('editArea').value = trabajador.Area || '';
                document.getElementById('editEstado').value = trabajador.Estado || 'Activo';
                document.getElementById('editFormContainer').classList.remove('hidden');
            } catch (error) {
                console.error(error);
                alert("Error al cargar datos del trabajador.");
            }
        });
    }

    const editarForm = document.getElementById('editarForm');
    if (editarForm) {
        editarForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const dni = document.getElementById('editDni').value.trim();
            const valores = [
                dni,
                document.getElementById('editNombre').value,
                document.getElementById('editPuesto').value,
                document.getElementById('editArea').value,
                document.getElementById('editEstado').value
            ];
            guardarRegistro('editarForm', 'Trabajadores', valores, 'upsert');
            setTimeout(() => {
                document.getElementById('editarForm').reset();
                document.getElementById('editFormContainer').classList.add('hidden');
            }, 1500);
        });
    }

    const editCancelarBtn = document.getElementById('editCancelarBtn');
    if (editCancelarBtn) {
        editCancelarBtn.addEventListener('click', () => {
            document.getElementById('editarForm').reset();
            document.getElementById('editFormContainer').classList.add('hidden');
        });
    }
});

// ==============================================================
//  LÓGICA DE PANEL DE ESTADÍSTICAS
// ==============================================================
let chartInstances = {};

async function cargarEstadisticas() {
    try {
        const noCache = new Date().getTime();
        const [reqTrabajadores, reqEMO, reqEPP, reqVacunas, reqActos, reqInduccion] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EMO&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EPPs&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vacunas&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Actos_Inseguros&action=readAll&_=${noCache}`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Induccion&action=readAll&_=${noCache}`)
        ]);

        const [trabajadores, emos, epps, vacunas, actos, inducciones] = await Promise.all([
            reqTrabajadores.json(), reqEMO.json(), reqEPP.json(), reqVacunas.json(), reqActos.json(), reqInduccion.json()
        ]);

        const trabajadoresActivos = trabajadores.filter(t => t.Estado !== 'Inactivo');

        generarGraficoEMO(trabajadoresActivos, emos);
        generarGraficoActosPorArea(actos, trabajadores);
        generarGraficoVacunacion(trabajadoresActivos, vacunas);
        generarGraficoEPP(trabajadoresActivos, epps);
        generarGraficoAreas(trabajadoresActivos);
        generarGraficoInduccion(trabajadoresActivos, inducciones);

    } catch (error) {
        console.error("Error cargando estadísticas:", error);
        alert("Error al cargar estadísticas. Verifique la conexión.");
    }
}

function generarGraficoEMO(trabajadores, emos) {
    let vigentes = 0, vencidos = 0, sinEMO = 0;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    trabajadores.forEach(t => {
        const miEMO = [...emos].reverse().find(e => e.DNI == t.DNI);
        if (!miEMO) { 
            sinEMO++; 
        } else {
            const fechaExamen = new Date(miEMO.Fecha_Examen);
            const fechaVencimiento = new Date(fechaExamen);
            fechaVencimiento.setFullYear(fechaExamen.getFullYear() + 1); 
            fechaVencimiento.setHours(0, 0, 0, 0);
            
            if (hoy > fechaVencimiento) vencidos++;
            else vigentes++;
        }
    });

    const ctx = document.getElementById('chartEMO').getContext('2d');
    if (chartInstances.emo) chartInstances.emo.destroy();
    chartInstances.emo = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`Vigentes (${vigentes})`, `Vencidos (${vencidos})`, `Sin EMO (${sinEMO})`],
            datasets: [{ data: [vigentes, vencidos, sinEMO], backgroundColor: ['#10b981', '#ef4444', '#f59e0b'], borderColor: '#fff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function generarGraficoActosPorArea(actos, trabajadores) {
    const actospPorArea = {};
    actos.forEach(acto => {
        const trabajador = trabajadores.find(t => t.DNI == acto.DNI);
        const area = trabajador ? trabajador.Area : 'Desconocida';
        actospPorArea[area] = (actospPorArea[area] || 0) + 1;
    });
    const areas = Object.keys(actospPorArea);
    const cantidad = Object.values(actospPorArea);
    const ctx = document.getElementById('chartActos').getContext('2d');
    if (chartInstances.actos) chartInstances.actos.destroy();
    chartInstances.actos = new Chart(ctx, {
        type: 'bar',
        data: { labels: areas, datasets: [{ label: 'Actos Inseguros', data: cantidad, backgroundColor: '#ef4444', borderColor: '#dc2626', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }
    });
}

function generarGraficoVacunacion(trabajadores, vacunas) {
    let completas = 0, incompletas = 0, sinVacunas = 0;
    trabajadores.forEach(t => {
        const miVacuna = [...vacunas].reverse().find(v => v.DNI == t.DNI);
        if (!miVacuna) { sinVacunas++; } else {
            const todasAplicadas = miVacuna.Hepatitis_B_Estado === 'Aplicada' && miVacuna.Influenza_Estado === 'Aplicada' && miVacuna.Tetanos_Estado === 'Aplicada' && miVacuna.COVID_Estado === 'Aplicada';
            if (todasAplicadas) completas++; else incompletas++;
        }
    });
    const ctx = document.getElementById('chartVacunas').getContext('2d');
    if (chartInstances.vacunas) chartInstances.vacunas.destroy();
    chartInstances.vacunas = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [`Completas (${completas})`, `Incompletas (${incompletas})`, `Sin Registro (${sinVacunas})`],
            datasets: [{ data: [completas, incompletas, sinVacunas], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderColor: '#fff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function generarGraficoEPP(trabajadores, epps) {
    let completos = 0, pendientes = 0, sinAsignar = 0;
    trabajadores.forEach(t => {
        const miEPP = [...epps].reverse().find(e => e.DNI == t.DNI);
        if (!miEPP) { sinAsignar++; } else {
            const esPendiente = miEPP.Casco === 'Pendiente' || miEPP.Zapato_Seguridad === 'Pendiente' || miEPP.Ropa_Trabajo === 'Pendiente';
            if (esPendiente) pendientes++; else completos++;
        }
    });
    const ctx = document.getElementById('chartEPP').getContext('2d');
    if (chartInstances.epp) chartInstances.epp.destroy();
    chartInstances.epp = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [`Completos (${completos})`, `Pendientes (${pendientes})`, `Sin Asignar (${sinAsignar})`],
            datasets: [{ data: [completos, pendientes, sinAsignar], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'], borderColor: '#fff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

function generarGraficoAreas(trabajadores) {
    const trabajadoresPorArea = {};
    trabajadores.forEach(t => {
        const area = t.Area || 'Desconocida';
        trabajadoresPorArea[area] = (trabajadoresPorArea[area] || 0) + 1;
    });
    const areas = Object.keys(trabajadoresPorArea);
    const cantidad = Object.values(trabajadoresPorArea);
    const colores = ['#0284c7', '#0891b2', '#0e7490', '#10b981', '#f59e0b', '#ef4444'];
    const ctx = document.getElementById('chartAreas').getContext('2d');
    if (chartInstances.areas) chartInstances.areas.destroy();
    chartInstances.areas = new Chart(ctx, {
        type: 'bar',
        data: { labels: areas, datasets: [{ label: 'Trabajadores', data: cantidad, backgroundColor: colores.slice(0, areas.length), borderColor: colores.slice(0, areas.length), borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function generarGraficoInduccion(trabajadores, inducciones) {
    let recibidas = 0, pendientes = 0;
    trabajadores.forEach(t => {
        const miInduccion = [...inducciones].reverse().find(i => i.DNI == t.DNI);
        if (miInduccion && miInduccion.Estado === 'Recibida') { recibidas++; } else { pendientes++; }
    });
    const ctx = document.getElementById('chartInduccion').getContext('2d');
    if (chartInstances.induccion) chartInstances.induccion.destroy();
    chartInstances.induccion = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: [`Recibidas (${recibidas})`, `Pendientes (${pendientes})`],
            datasets: [{ data: [recibidas, pendientes], backgroundColor: ['#10b981', '#f59e0b'], borderColor: '#fff', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}
// ==============================================================
//  GENERADOR DE EXCEL MAESTRO (CLIENT-SIDE)
// ==============================================================
const btnDescargarExcel = document.getElementById('btnDescargarExcel');
if (btnDescargarExcel) {
    btnDescargarExcel.addEventListener('click', async () => {
        const originalText = btnDescargarExcel.innerHTML;
        btnDescargarExcel.innerHTML = '<span>⏳</span> Construyendo Excel...';
        btnDescargarExcel.disabled = true;

        try {
            const noCache = new Date().getTime();
            // Lista exacta de las hojas que tienes en tu Google Sheets
            const hojas = ['Trabajadores', 'EPPs', 'Capacitaciones', 'Induccion', 'RISST', 'EMO', 'Actos_Inseguros', 'IPERC', 'PTAR', 'Vigilancia_Medica', 'Vacunas'];
            
            // Creamos un libro de Excel en blanco
            const wb = XLSX.utils.book_new();

            // Descargamos la data de TODAS las hojas al mismo tiempo
            const promesas = hojas.map(sheet => fetch(`${GOOGLE_SCRIPT_URL}?sheet=${sheet}&action=readAll&_=${noCache}`).then(r => r.json()));
            const resultados = await Promise.all(promesas);

            // Recorremos cada resultado y lo convertimos en una pestaña del Excel
            hojas.forEach((nombreHoja, index) => {
                const data = resultados[index];
                
                // Si la hoja tiene datos, la pasamos a Excel. Si está vacía, le ponemos un mensajito.
                const dataFinal = data.length > 0 ? data : [{ Mensaje: "No hay registros en este módulo aún." }];
                
                const ws = XLSX.utils.json_to_sheet(dataFinal);
                XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
            });

            // Usamos la función formatFecha que ya tienes en el otro archivo para el nombre del archivo
            const fechaHoy = new Date().toISOString().split('T')[0];
            const nombreArchivo = `SST_Manager_Backup_${fechaHoy}.xlsx`;

            // ¡Forzamos la descarga del Excel armado!
            XLSX.writeFile(wb, nombreArchivo);

        } catch (error) {
            console.error(error);
            alert("Error al intentar generar el archivo Excel. Verifique su conexión.");
        } finally {
            btnDescargarExcel.innerHTML = originalText;
            btnDescargarExcel.disabled = false;
        }
    });
}
// ============================================================== FIN DE APP.JS ==============================================================
