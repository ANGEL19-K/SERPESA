import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.SST_CONFIG || {};
const badConfig = !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_URL.includes("PEGA_AQUI");
const supabase = badConfig ? null : createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];
const TABLES = ["trabajadores","emos","epps","capacitaciones","inducciones","risst","actos_inseguros","iperc","ptar","vigilancia_medica","vacunas"];
let workersCache = [];

function toast(message,type="good"){const el=document.createElement("div");el.className=`toast ${type}`;el.textContent=message;$("toastRoot").appendChild(el);setTimeout(()=>el.remove(),3600)}
function esc(v=""){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]))}
function fmtDate(v){if(!v)return".";const d=new Date(`${String(v).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?".":new Intl.DateTimeFormat("es-PE").format(d)}
function validDni(v){return /^\d{8}$/.test(String(v||"").trim())}
function emoState(emo){if(!emo?.fecha_examen)return{label:"Sin EMO",cls:"bad",days:null,expiry:null};const ex=new Date(`${emo.fecha_examen}T12:00:00`),xp=new Date(ex);xp.setFullYear(xp.getFullYear()+1);const now=new Date();now.setHours(12,0,0,0);const days=Math.ceil((xp-now)/86400000);if(days<0)return{label:`Vencido hace ${Math.abs(days)} días`,cls:"bad",days,expiry:xp};if(days<=30)return{label:days===0?"Vence hoy":`Vence en ${days} días`,cls:"warn",days,expiry:xp};if(["Observado","No apto"].includes(emo.aptitud))return{label:emo.aptitud,cls:"bad",days,expiry:xp};if(emo.aptitud==="Apto con restricciones")return{label:"Vigente con restricciones",cls:"warn",days,expiry:xp};return{label:"Vigente",cls:"good",days,expiry:xp}}
async function session(){if(badConfig)return null;return(await supabase.auth.getSession()).data.session}
async function apiFetch(path,options={}){const s=await session();if(!s)throw new Error("Sesión expirada");const res=await fetch(`${cfg.API_URL.replace(/\/$/,"")}${path}`,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${s.access_token}`,...(options.headers||{})}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body.error||`Error API ${res.status}`);return body}
function showApp(s){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("sessionEmail").textContent=s?.user?.email||"Usuario SST";loadDashboard()}
function showLogin(){$("appView").classList.add("hidden");$("loginView").classList.remove("hidden")}

$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(badConfig)return $("loginMsg").textContent="Completa config.js antes de iniciar sesión.";$("loginMsg").textContent="Ingresando...";const{data,error}=await supabase.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)return $("loginMsg").textContent=error.message;$("loginMsg").textContent="";showApp(data.session)});
$("logoutBtn").addEventListener("click",async()=>{await supabase.auth.signOut();showLogin()});
$$(".nav-item").forEach(btn=>btn.addEventListener("click",()=>{$$(".nav-item").forEach(x=>x.classList.remove("active"));btn.classList.add("active");$$(".page").forEach(x=>x.classList.remove("active"));const t=btn.dataset.target;$(t).classList.add("active");$("pageTitle").textContent=btn.textContent.trim();$("sidebar").classList.remove("open");if(t==="dashboard")loadDashboard();if(t==="alertas")loadAlerts();if(t==="trabajadores")loadWorkers()}));
$("mobileMenuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
$("refreshBtn").addEventListener("click",()=>{const a=document.querySelector(".page.active")?.id;if(a==="alertas")loadAlerts();else if(a==="trabajadores")loadWorkers();else loadDashboard()});

async function getWorker(dni){const{data,error}=await supabase.from("trabajadores").select("*").eq("dni",dni).maybeSingle();if(error)throw error;return data}

async function loadDashboard(){
 try{
  const[w,e,c]=await Promise.all([
   supabase.from("trabajadores").select("dni,estado",{count:"exact"}),
   supabase.from("emos").select("dni,fecha_examen,aptitud").order("fecha_examen",{ascending:false}),
   supabase.from("capacitaciones").select("id,tema_capacitacion,asistio",{count:"exact"})
  ]);
  [w,e,c].forEach(r=>{if(r.error)throw r.error});
  const activeWorkers=(w.data||[]).filter(x=>x.estado!=="Inactivo"), latest=new Map();
  (e.data||[]).forEach(x=>{if(!latest.has(x.dni))latest.set(x.dni,x)});
  let current=0,soon=0,expired=0,observed=0,noemo=0;
  activeWorkers.forEach(wr=>{const em=latest.get(wr.dni);if(!em){noemo++;return}const st=emoState(em);if(["Observado","No apto"].includes(em.aptitud))observed++;if(st.days<0)expired++;else if(st.days<=30)soon++;else current++});
  $("kpiGrid").innerHTML=[["Trabajadores activos",activeWorkers.length,"Base maestra"],["EMO vigentes",current,"Más de 30 días"],["EMO por vencer",soon,"Próximos 30 días"],["Capacitaciones",c.count??(c.data||[]).length,"Registros históricos"]].map(([l,v,s])=>`<div class="kpi"><span>${l}</span><strong>${v}</strong><small>${s}</small></div>`).join("");
  $("emoOverview").innerHTML=[["Vencidos",expired],["Por vencer",soon],["Observados / no aptos",observed],["Sin EMO",noemo]].map(([l,v])=>`<div class="overview-row"><span>${l}</span><strong>${v}</strong></div>`).join("");
  const topics={};(c.data||[]).forEach(x=>topics[x.tema_capacitacion]=(topics[x.tema_capacitacion]||0)+1);const top=Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,5);
  $("trainingOverview").innerHTML=top.length?top.map(([l,v])=>`<div class="overview-row"><span>${esc(l)}</span><strong>${v}</strong></div>`).join(""):'<div class="empty-state">No hay capacitaciones.</div>';
  $("lastRefresh").textContent=new Intl.DateTimeFormat("es-PE",{dateStyle:"medium",timeStyle:"short"}).format(new Date());
 }catch(err){toast(`Dashboard: ${err.message}`,"bad")}
}

async function search360(dni){
 if(!validDni(dni))return toast("Ingrese un DNI válido de 8 dígitos","bad");
 $("searchResult").innerHTML="Consultando expediente...";
 try{
  const worker=await getWorker(dni);if(!worker)return $("searchResult").innerHTML='<div class="empty-state">Trabajador no encontrado.</div>';
  const[emo,epp,vac,ind,ris,acts,caps,ip,pt,vig]=await Promise.all([
   supabase.from("emos").select("*").eq("dni",dni).order("fecha_examen",{ascending:false}).limit(1),
   supabase.from("epps").select("*").eq("dni",dni).maybeSingle(),
   supabase.from("vacunas").select("*").eq("dni",dni).maybeSingle(),
   supabase.from("inducciones").select("*").eq("dni",dni).maybeSingle(),
   supabase.from("risst").select("*").eq("dni",dni).maybeSingle(),
   supabase.from("actos_inseguros").select("id",{count:"exact",head:true}).eq("dni",dni),
   supabase.from("capacitaciones").select("id",{count:"exact",head:true}).eq("dni",dni),
   supabase.from("iperc").select("id",{count:"exact",head:true}).eq("dni",dni),
   supabase.from("ptar").select("id",{count:"exact",head:true}).eq("dni",dni),
   supabase.from("vigilancia_medica").select("*").eq("dni",dni).maybeSingle()
  ]);
  const em=emo.data?.[0],es=emoState(em);
  const eppOk=epp.data&&[epp.data.zapato_seguridad,epp.data.ropa_trabajo,epp.data.casco].every(x=>x==="Entregado");
  const vacOk=vac.data&&[vac.data.hepatitis_estado,vac.data.influenza_estado,vac.data.tetanos_estado,vac.data.covid_estado].every(x=>x==="Aplicada"||x==="No aplica");
  const cards=[
   ["EMO",em?es.label:"Sin EMO",em?`${em.aptitud} · vence ${fmtDate(es.expiry?.toISOString().slice(0,10))}`:"Sin registro",es.cls],
   ["EPP",epp.data?(eppOk?"Completo":"Pendiente"):"Sin asignar","Zapatos · Ropa · Casco",eppOk?"good":"warn"],
   ["Vacunas",vac.data?(vacOk?"Al día":"Incompleto"):"Sin registro","Esquema ocupacional",vacOk?"good":"warn"],
   ["Inducción",ind.data?.recibio_induccion||"Pendiente",fmtDate(ind.data?.fecha_induccion),ind.data?.recibio_induccion==="Recibida"?"good":"bad"],
   ["RISST",ris.data?.se_entrego_risst==="Si"?"Entregado":"No entregado",fmtDate(ris.data?.fecha_entrega),ris.data?.se_entrego_risst==="Si"?"good":"bad"],
   ["Actos inseguros",`${acts.count||0} registros`,"Historial total",(acts.count||0)>0?"warn":"good"],
   ["Capacitaciones",`${caps.count||0} registros`,"Historial total","good"],
   ["IPERC",`${ip.count||0} registros`,"Controles registrados","good"],
   ["PTAR",`${pt.count||0} permisos`,"Historial","good"],
   ["Vigilancia",vig.data?(vig.data.requiere_vigilancia==="Si"?"Requiere":"No requiere"):"Sin registro",vig.data?.detalle_vigilancia||".",vig.data?.requiere_vigilancia==="Si"?"warn":"good"]
  ];
  $("searchResult").innerHTML=`<div class="profile-card"><div class="profile-grid"><div><div class="profile-label">Trabajador</div><div class="profile-value">${esc(worker.nombre_completo)}</div></div><div><div class="profile-label">DNI</div><div class="profile-value">${worker.dni}</div></div><div><div class="profile-label">Puesto</div><div class="profile-value">${esc(worker.puesto||".")}</div></div><div><div class="profile-label">Ingreso</div><div class="profile-value">${fmtDate(worker.fecha_ingreso)}</div></div></div></div><div class="status-grid">${cards.map(([l,v,s,c])=>`<div class="status-card"><div class="label">${l}</div><div class="value text-${c}">${esc(v)}</div><div class="sub">${esc(s)}</div></div>`).join("")}</div>${em?.documento_key?`<div class="panel" style="margin-top:14px"><div class="panel-head"><h3>Documento EMO actual</h3></div><button class="btn btn-secondary view-doc" data-key="${esc(em.documento_key)}">Visualizar documento</button></div>`:""}`;
  $$(".view-doc").forEach(b=>b.addEventListener("click",()=>viewDocument(b.dataset.key)));
 }catch(err){$("searchResult").innerHTML=`<div class="empty-state">${esc(err.message)}</div>`}
}
$("searchBtn").addEventListener("click",()=>search360($("searchDni").value.trim()));
$("searchDni").addEventListener("keydown",e=>{if(e.key==="Enter")search360(e.target.value.trim())});

async function loadAlerts(){
 $("alertsRoot").innerHTML='<div class="empty-state">Calculando alertas...</div>';
 try{
  const cutoff=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const[w,e,ep,v,a]=await Promise.all([
   supabase.from("trabajadores").select("dni,nombre_completo,estado").eq("estado","Activo"),
   supabase.from("emos").select("dni,fecha_examen,aptitud,detalle_restriccion").order("fecha_examen",{ascending:false}),
   supabase.from("epps").select("*"),supabase.from("vacunas").select("*"),
   supabase.from("actos_inseguros").select("*").gte("fecha_inspeccion",cutoff).order("fecha_inspeccion",{ascending:false})
  ]);[w,e,ep,v,a].forEach(r=>{if(r.error)throw r.error});
  const latest=new Map();e.data.forEach(x=>{if(!latest.has(x.dni))latest.set(x.dni,x)});const eppMap=new Map(ep.data.map(x=>[x.dni,x])),vacMap=new Map(v.data.map(x=>[x.dni,x]));
  const b={expired:[],soon:[],medical:[],epp:[],vaccines:[],acts:[]};
  w.data.forEach(worker=>{const em=latest.get(worker.dni);if(!em)b.expired.push({worker,detail:"Sin EMO registrado"});else{const st=emoState(em);if(st.days<0)b.expired.push({worker,detail:st.label});else if(st.days<=30)b.soon.push({worker,detail:`${st.label} · ${em.aptitud}`});if(["Observado","No apto"].includes(em.aptitud))b.medical.push({worker,detail:`${em.aptitud}: ${em.detalle_restriccion}`})}const pp=eppMap.get(worker.dni);if(!pp||[pp.zapato_seguridad,pp.ropa_trabajo,pp.casco].some(x=>x!=="Entregado"))b.epp.push({worker,detail:"EPP incompleto o sin asignar"});const vv=vacMap.get(worker.dni);if(!vv||[vv.hepatitis_estado,vv.influenza_estado,vv.tetanos_estado,vv.covid_estado].some(x=>x!=="Aplicada"&&x!=="No aplica"))b.vaccines.push({worker,detail:"Esquema de vacunación incompleto"})});
  a.data.forEach(x=>{const worker=w.data.find(y=>y.dni===x.dni)||{dni:x.dni,nombre_completo:"Trabajador"};b.acts.push({worker,detail:`${fmtDate(x.fecha_inspeccion)} · ${x.acto_inseguro_cometido}`})});
  const defs=[["EMO vencidos / faltantes",b.expired,"bad"],["EMO por vencer (30 días)",b.soon,"warn"],["Observados / no aptos",b.medical,"bad"],["EPP pendiente",b.epp,"warn"],["Vacunación pendiente",b.vaccines,"warn"],["Actos inseguros últimos 7 días",b.acts,"bad"]];
  $("alertsRoot").innerHTML=defs.map(([title,items,cls])=>`<div class="alert-box"><div class="alert-box-head"><h3>${title}</h3><span class="pill ${cls}">${items.length}</span></div><div class="alert-list">${items.length?items.map(i=>`<div class="alert-item alert-worker" data-dni="${i.worker.dni}"><strong>${esc(i.worker.nombre_completo)} · ${i.worker.dni}</strong><span>${esc(i.detail)}</span></div>`).join(""):'<div class="empty-state" style="margin:12px">Sin pendientes.</div>'}</div></div>`).join("");
  $$(".alert-worker").forEach(el=>el.addEventListener("click",()=>{document.querySelector('[data-target="buscador"]').click();$("searchDni").value=el.dataset.dni;search360(el.dataset.dni)}));
 }catch(err){$("alertsRoot").innerHTML=`<div class="empty-state">${esc(err.message)}</div>`}
}

async function loadWorkers(){const{data,error}=await supabase.from("trabajadores").select("*").order("nombre_completo");if(error)return toast(error.message,"bad");workersCache=data||[];renderWorkers(workersCache)}
function renderWorkers(rows){$("workerCount").textContent=rows.length;$("workersTable").innerHTML=`<table><thead><tr><th>DNI</th><th>Trabajador</th><th>Puesto</th><th>Ingreso</th><th></th></tr></thead><tbody>${rows.map(w=>`<tr><td>${w.dni}</td><td><strong>${esc(w.nombre_completo)}</strong><br><span class="muted">${esc(w.estado)}</span></td><td>${esc(w.puesto||".")}</td><td>${fmtDate(w.fecha_ingreso)}</td><td><button class="row-action edit-worker" data-dni="${w.dni}">Editar</button></td></tr>`).join("")}</tbody></table>`;$$(".edit-worker").forEach(b=>b.addEventListener("click",()=>{const w=workersCache.find(x=>x.dni===b.dataset.dni);if(!w)return;$("workerDni").value=w.dni;$("workerName").value=w.nombre_completo;$("workerPosition").value=w.puesto||".";$("workerArea").value=w.area||".";$("workerStart").value=w.fecha_ingreso||"";$("workerStatus").value=w.estado;window.scrollTo({top:0,behavior:"smooth"})}))}
$("workerFilter").addEventListener("input",e=>{const q=e.target.value.toLowerCase();renderWorkers(workersCache.filter(w=>`${w.dni} ${w.nombre_completo} ${w.puesto}`.toLowerCase().includes(q)))});
$("workerForm").addEventListener("submit",async e=>{e.preventDefault();const dni=$("workerDni").value.trim();if(!validDni(dni))return toast("DNI inválido","bad");const row={dni,nombre_completo:$("workerName").value.trim(),puesto:$("workerPosition").value.trim()||".",area:$("workerArea").value.trim()||".",fecha_ingreso:$("workerStart").value||null,estado:$("workerStatus").value};const{error}=await supabase.from("trabajadores").upsert(row,{onConflict:"dni"});if(error)return toast(error.message,"bad");toast("Trabajador guardado");e.target.reset();loadWorkers()});

async function loadEmoWorker(){const dni=$("emoDni").value.trim();if(!validDni(dni))return toast("DNI inválido","bad");try{const w=await getWorker(dni);$("emoWorkerName").value=w?.nombre_completo||"NO ENCONTRADO";await renderEmoHistory(dni)}catch(err){toast(err.message,"bad")}}
$("emoLookupBtn").addEventListener("click",loadEmoWorker);
async function renderEmoHistory(dni){const{data,error}=await supabase.from("emos").select("*").eq("dni",dni).order("fecha_examen",{ascending:false});if(error)throw error;if(!data.length){$("emoCurrentBadge").textContent="Sin EMO";$("emoHistory").innerHTML='<div class="empty-state">No hay registros EMO.</div>';return}const st=emoState(data[0]);$("emoCurrentBadge").className=`pill ${st.cls}`;$("emoCurrentBadge").textContent=st.label;$("emoHistory").innerHTML=data.map(x=>{const es=emoState(x);return`<div class="history-card"><div class="history-top"><div><h4>${fmtDate(x.fecha_examen)} · ${esc(x.aptitud)}</h4><p>${esc(x.detalle_restriccion||"Ninguna")}</p></div><span class="pill ${es.cls}">${esc(es.label)}</span></div><div class="doc-actions" style="margin-top:10px">${x.documento_key?`<button class="mini-btn emo-view" data-key="${esc(x.documento_key)}">Visualizar</button>`:""}<button class="mini-btn emo-load" data-date="${x.fecha_examen}" data-fit="${esc(x.aptitud)}" data-detail="${esc(x.detalle_restriccion||"")}">${x.documento_key?"Editar datos":"Adjuntar / editar"}</button></div></div>`}).join("");$$(".emo-view").forEach(b=>b.addEventListener("click",()=>viewDocument(b.dataset.key)));$$(".emo-load").forEach(b=>b.addEventListener("click",()=>{$("emoDate").value=b.dataset.date;$("emoFitness").value=b.dataset.fit;$("emoRestriction").value=b.dataset.detail;window.scrollTo({top:0,behavior:"smooth"})}))}
async function uploadEmoFile(file,dni,date){if(!file)return null;if(file.size>15*1024*1024)throw new Error("El archivo supera 15 MB");const allowed=["application/pdf","image/jpeg","image/png","image/webp"];if(!allowed.includes(file.type))throw new Error("Formato no permitido");const signed=await apiFetch("/r2/upload-url",{method:"POST",body:JSON.stringify({dni,fecha:date,nombreArchivo:file.name,contentType:file.type,size:file.size})});const up=await fetch(signed.uploadUrl,{method:"PUT",headers:{"Content-Type":file.type},body:file});if(!up.ok)throw new Error("R2 rechazó la carga");return{documento_key:signed.key,documento_nombre:file.name,documento_tipo:file.type}}
async function viewDocument(key){try{const out=await apiFetch("/r2/view-url",{method:"POST",body:JSON.stringify({key})});window.open(out.viewUrl,"_blank","noopener,noreferrer")}catch(err){toast(err.message,"bad")}}
$("emoForm").addEventListener("submit",async e=>{e.preventDefault();const btn=e.submitter,dni=$("emoDni").value.trim(),date=$("emoDate").value,fit=$("emoFitness").value;if(!validDni(dni)||!date||!fit)return toast("Complete DNI, fecha y aptitud","bad");btn.disabled=true;btn.textContent="Guardando...";try{const worker=await getWorker(dni);if(!worker)throw new Error("Trabajador no existe");const doc=await uploadEmoFile($("emoFile").files[0],dni,date);const row={dni,fecha_examen:date,aptitud:fit,detalle_restriccion:$("emoRestriction").value.trim()||"Ninguna",...(doc||{})};const{error}=await supabase.from("emos").upsert(row,{onConflict:"dni,fecha_examen"});if(error)throw error;toast("EMO guardado correctamente");$("emoWorkerName").value=worker.nombre_completo;$("emoFile").value="";await renderEmoHistory(dni)}catch(err){toast(err.message,"bad")}finally{btn.disabled=false;btn.textContent="Guardar / actualizar EMO"}});

async function ensureWorker(dni){if(!validDni(dni))throw new Error("DNI inválido");const w=await getWorker(dni);if(!w)throw new Error("Trabajador no registrado");return w}
function bindUpsert(id,table,conflict,build){$(id).addEventListener("submit",async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const row=build();await ensureWorker(row.dni);const{error}=await supabase.from(table).upsert(row,{onConflict:conflict});if(error)throw error;toast("Registro guardado")}catch(err){toast(err.message,"bad")}finally{btn.disabled=false}})}
function bindInsert(id,table,build){$(id).addEventListener("submit",async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{const row=build();await ensureWorker(row.dni);const{error}=await supabase.from(table).insert(row);if(error)throw error;toast("Registro guardado");e.target.reset()}catch(err){toast(err.message,"bad")}finally{btn.disabled=false}})}
bindUpsert("eppForm","epps","dni",()=>({dni:$("eppDni").value.trim(),zapato_seguridad:$("eppShoes").value,fecha_zapato:$("eppShoesDate").value||null,ropa_trabajo:$("eppClothes").value,fecha_ropa:$("eppClothesDate").value||null,casco:$("eppHelmet").value,fecha_casco:$("eppHelmetDate").value||null}));
bindUpsert("indForm","inducciones","dni",()=>({dni:$("indDni").value.trim(),recibio_induccion:$("indStatus").value,fecha_induccion:$("indDate").value||null}));
bindUpsert("risstForm","risst","dni",()=>({dni:$("risstDni").value.trim(),se_entrego_risst:$("risstStatus").value,fecha_entrega:$("risstDate").value||null}));
bindInsert("actForm","actos_inseguros",()=>({dni:$("actDni").value.trim(),fecha_inspeccion:$("actDate").value,acto_inseguro_cometido:$("actName").value.trim(),detalle_motivo:$("actDetail").value.trim()||null,medida_correctiva:$("actMeasure").value.trim()||null}));
bindUpsert("ipercForm","iperc","dni,fecha",()=>({dni:$("ipercDni").value.trim(),fecha:$("ipercDate").value,elaboro_iperc:$("ipercDone").value}));
bindUpsert("ptarForm","ptar","dni,fecha",()=>({dni:$("ptarDni").value.trim(),fecha:$("ptarDate").value,requiere_ptar:$("ptarNeed").value,elaboro_ptar:$("ptarDone").value}));
bindUpsert("vigForm","vigilancia_medica","dni",()=>({dni:$("vigDni").value.trim(),enfermedad_previa:$("vigDisease").value.trim()||"Ninguna",requiere_vigilancia:$("vigNeed").value,detalle_vigilancia:$("vigDetail").value.trim()||"N/A"}));
bindUpsert("vacForm","vacunas","dni",()=>({dni:$("vacDni").value.trim(),hepatitis_estado:$("vacHep").value,hepatitis_fecha:$("vacHepDate").value||null,influenza_estado:$("vacFlu").value,influenza_fecha:$("vacFluDate").value||null,tetanos_estado:$("vacTet").value,tetanos_fecha:$("vacTetDate").value||null,covid_estado:$("vacCovid").value,covid_fecha:$("vacCovidDate").value||null}));

$("capForm").addEventListener("submit",async e=>{e.preventDefault();const dni=$("capDni").value.trim();try{await ensureWorker(dni);const row={dni,tema_capacitacion:$("capTopic").value.trim(),fecha_programada:$("capScheduled").value,asistio:$("capAttended").value,fecha_asistencia:$("capAttendedDate").value||null};const{error}=await supabase.from("capacitaciones").upsert(row,{onConflict:"dni,tema_capacitacion,fecha_programada"});if(error)throw error;toast("Capacitación guardada");e.target.reset()}catch(err){toast(err.message,"bad")}});
$("capSearchBtn").addEventListener("click",async()=>{const dni=$("capSearchDni").value.trim();if(!validDni(dni))return toast("DNI inválido","bad");const{data,error}=await supabase.from("capacitaciones").select("*").eq("dni",dni).order("fecha_programada",{ascending:false});if(error)return toast(error.message,"bad");$("capHistory").innerHTML=data.length?`<div class="table-wrap"><table><thead><tr><th>Tema</th><th>Programada</th><th>Asistió</th><th>Fecha</th></tr></thead><tbody>${data.map(x=>`<tr><td>${esc(x.tema_capacitacion)}</td><td>${fmtDate(x.fecha_programada)}</td><td>${x.asistio}</td><td>${fmtDate(x.fecha_asistencia)}</td></tr>`).join("")}</tbody></table></div>`:'<div class="empty-state">No hay registros.</div>'});

$("backupBtn").addEventListener("click",async()=>{const btn=$("backupBtn");btn.disabled=true;btn.textContent="Generando...";try{const wb=XLSX.utils.book_new();for(const table of TABLES){const{data,error}=await supabase.from(table).select("*");if(error)throw error;const ws=XLSX.utils.json_to_sheet(data?.length?data:[{Mensaje:"No hay registros"}]);XLSX.utils.book_append_sheet(wb,ws,table.slice(0,31))}XLSX.writeFile(wb,`SST_Manager_Backup_${new Date().toISOString().slice(0,10)}.xlsx`);toast("Backup generado")}catch(err){toast(err.message,"bad")}finally{btn.disabled=false;btn.textContent="Exportar backup"}});

(async()=>{const s=await session();if(s)showApp(s);else{showLogin();if(badConfig)$("loginMsg").textContent="Completa frontend/config.js con Supabase antes de ingresar."}if(supabase)supabase.auth.onAuthStateChange((_e,s)=>{if(s)showApp(s)})})();
