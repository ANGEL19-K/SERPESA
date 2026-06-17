// ==============================================================
//  FUNCIONES GLOBALES (FUERA DE DOMContentLoaded)
// ==============================================================

// ==============================================================
//  LÓGICA DE ALERTAS GLOBALES DEL SISTEMA
// ==============================================================
async function cargarAlertasGlobales() {
    const alertasContainer = document.getElementById('alertasContainer');
    const alertasList = document.getElementById('alertasList');
    const noAlertsMsg = document.getElementById('noAlertsMsg');
    
    try {
        const [reqTrabajadores, reqEMO, reqEPP, reqVacunas, reqActos, reqInduccion] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EMO&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EPPs&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vacunas&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Actos_Inseguros&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Induccion&action=readAll`)
        ]);

        const [trabajadores, emos, epps, vacunas, actos, inducciones] = await Promise.all([
            reqTrabajadores.json(), reqEMO.json(), reqEPP.json(), reqVacunas.json(), reqActos.json(), reqInduccion.json()
        ]);

        const trabajadoresActivos = trabajadores.filter(t => t.Estado !== 'Inactivo');
        const alertas = [];

        // Alerta 1: EMO próximo a vencer (< 60 días)
        const hoy = new Date();
        trabajadoresActivos.forEach(t => {
            const miEMO = emos.find(e => e.DNI == t.DNI);
            if (miEMO && miEMO.Fecha_Examen) {
                const fechaExamen = new Date(miEMO.Fecha_Examen);
                const diasRestantes = Math.floor((fechaExamen - hoy) / (1000 * 60 * 60 * 24));
                if (diasRestantes >= 0 && diasRestantes < 60) {
                    alertas.push({
                        tipo: 'emo',
                        titulo: `📋 ${t.Nombre_Completo || t.Nombre} - EMO próximo a vencer`,
                        detalle: `Vence en ${diasRestantes} días (${formatFecha(miEMO.Fecha_Examen)})`,
                        dni: t.DNI,
                        prioridad: diasRestantes < 15 ? 'critica' : 'warning'
                    });
                }
            }
        });

        // Alerta 2: EPP pendiente
        trabajadoresActivos.forEach(t => {
            const miEPP = epps.find(e => e.DNI == t.DNI);
            if (!miEPP || miEPP.Casco === 'Pendiente' || miEPP.Zapato_Seguridad === 'Pendiente' || miEPP.Ropa_Trabajo === 'Pendiente') {
                alertas.push({
                    tipo: 'epp',
                    titulo: `🛡️ ${t.Nombre_Completo || t.Nombre} - Equipos pendientes`,
                    detalle: 'Tiene EPP sin asignar o incompletos',
                    dni: t.DNI,
                    prioridad: 'warning'
                });
            }
        });

        // Alerta 3: Vacunas pendientes
        trabajadoresActivos.forEach(t => {
            const miVacuna = vacunas.find(v => v.DNI == t.DNI);
            if (!miVacuna || miVacuna.Tetanos_Estado === 'Pendiente' || miVacuna.COVID_Estado === 'Pendiente') {
                alertas.push({
                    tipo: 'vacunas',
                    titulo: `💉 ${t.Nombre_Completo || t.Nombre} - Vacunas incompletas`,
                    detalle: 'Faltan vacunas por aplicar',
                    dni: t.DNI,
                    prioridad: 'warning'
                });
            }
        });

        // Alerta 4: Actos inseguros sin cerrar (últimos 7 días)
        const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
        const actosRecientes = actos.filter(a => new Date(a.Fecha_Inspeccion) > hace7dias);
        if (actosRecientes.length > 0) {
            alertas.push({
                tipo: 'actos',
                titulo: `⚠️ Actos inseguros recientes`,
                detalle: `${actosRecientes.length} acto(s) reportado(s) en los últimos 7 días`,
                dni: null,
                prioridad: 'warning'
            });
        }

        // Mostrar alertas
        if (alertas.length === 0) {
            alertasContainer.classList.add('hidden');
            if(noAlertsMsg) noAlertsMsg.classList.remove('hidden');
        } else {
            alertasContainer.classList.remove('hidden');
            if(noAlertsMsg) noAlertsMsg.classList.add('hidden');
            
            alertasList.innerHTML = '';
            alertas.forEach(alerta => {
                const alertaEl = document.createElement('div');
                alertaEl.className = `alerta-item ${alerta.prioridad === 'critica' ? '' : 'warning'}`;
                alertaEl.innerHTML = `
                    <div class="alerta-content">
                        <div class="alerta-titulo">${alerta.titulo}</div>
                        <div class="alerta-detalle">${alerta.detalle}</div>
                    </div>
                    ${alerta.prioridad === 'critica' ? '<div class="alerta-badge">CRÍTICO</div>' : ''}
                `;
                if (alerta.dni) {
                    alertaEl.addEventListener('click', () => {
                        // Cambiar al tab de buscador
                        document.querySelector('.nav-btn[data-target="mod-search"]').click();
                        // Llenar el input y buscar
                        document.getElementById('searchInput').value = alerta.dni;
                        document.getElementById('searchBtn').click();
                    });
                }
                alertasList.appendChild(alertaEl);
            });
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
            // Remover la clase 'active' de todos los botones y módulos
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
            
            // Agregar 'active' al botón clicado y al módulo correspondiente
            const buttonClicked = e.target.closest('.nav-btn');
            buttonClicked.classList.add('active');
            
            const targetId = buttonClicked.getAttribute('data-target');
            const targetModule = document.getElementById(targetId);
            if (targetModule) {
                targetModule.classList.add('active');
            }

            // Si es el módulo de estadísticas, cargar los gráficos
            if (targetId === 'mod-estadisticas') {
                cargarEstadisticas();
            }

            // Si es el módulo de alertas, cargarlas
            if (targetId === 'mod-alertas') {
                cargarAlertasGlobales();
            }
        });
    });

    // --- Lógica Condicional: Módulo 5 (EMO) ---
    const emoAptitud = document.getElementById('emoAptitud');
    const emoRestriccionesContainer = document.getElementById('emoRestriccionesContainer');
    const emoDetalleRestriccion = document.getElementById('emoDetalleRestriccion');

    if (emoAptitud) {
        emoAptitud.addEventListener('change', (e) => {
            if (e.target.value === 'Apto con restricciones') {
                emoRestriccionesContainer.classList.remove('hidden');
                emoDetalleRestriccion.setAttribute('required', 'true');
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
                const res = await fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll`);
                const trabajadores = await res.json();
                const trabajador = trabajadores.find(t => t.DNI == dni || t.DNI === parseInt(dni));

                if (!trabajador) {
                    return alert("Trabajador no encontrado en la base de datos.");
                }

                // Llenar el formulario con los datos del trabajador
                document.getElementById('editNombre').value = trabajador.Nombre_Completo || trabajador.Nombre || '';
                document.getElementById('editPuesto').value = trabajador.Puesto || '';
                document.getElementById('editArea').value = trabajador.Area || '';
                document.getElementById('editEstado').value = trabajador.Estado || 'Activo';

                // Mostrar el formulario de edición
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
            // Llamamos a guardarRegistro (que vive en sheets-api.js)
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
        const [reqTrabajadores, reqEMO, reqEPP, reqVacunas, reqActos, reqInduccion] = await Promise.all([
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Trabajadores&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EMO&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=EPPs&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Vacunas&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Actos_Inseguros&action=readAll`),
            fetch(`${GOOGLE_SCRIPT_URL}?sheet=Induccion&action=readAll`)
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
    trabajadores.forEach(t => {
        const miEMO = emos.find(e => e.DNI == t.DNI);
        if (!miEMO) { sinEMO++; } else {
            const fechaExamen = new Date(miEMO.Fecha_Examen);
            const hoy = new Date();
            const meses = (hoy.getFullYear() - fechaExamen.getFullYear()) * 12 + (hoy.getMonth() - fechaExamen.getMonth());
            if (meses >= 12) vencidos++;
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
        const miVacuna = vacunas.find(v => v.DNI == t.DNI);
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
        const miEPP = epps.find(e => e.DNI == t.DNI);
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
        const miInduccion = inducciones.find(i => i.DNI == t.DNI);
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
// ============================================================== FIN DE APP.JS ==============================================================