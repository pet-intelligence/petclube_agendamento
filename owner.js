const API_BASE_URL = (window.PETCLUB_API_URL || "https://api.petintelligence.com.br").replace(/\/$/, "");
const ADMIN_TOKEN_KEY = "pet_clube_admin_token";
const STATUSES = ["Novo", "Confirmado", "Em atendimento", "Pronto", "Finalizado", "Cancelado"];

let bookings = [];

const loginPanel = document.querySelector("#owner-login");
const ownerApp = document.querySelector("#owner-app");
const loginForm = document.querySelector("#owner-login-form");
const tokenInput = document.querySelector("#admin-token");
const loginWarning = document.querySelector("#login-warning");
const filterDate = document.querySelector("#filter-date");
const filterStatus = document.querySelector("#filter-status");
const exportButton = document.querySelector("#export-csv");
const bookingsBody = document.querySelector("#bookings-body");
const warning = document.querySelector("#owner-warning");

init();

function init() {
  filterDate.value = new Date().toISOString().slice(0, 10);
  filterStatus.innerHTML = ['<option value="">Todos</option>', ...STATUSES.map((status) => `<option>${escapeHtml(status)}</option>`)].join("");
  loginForm.addEventListener("submit", handleLogin);
  filterDate.addEventListener("change", loadBookings);
  filterStatus.addEventListener("change", renderBookings);
  exportButton.addEventListener("click", exportCsv);
  bookingsBody.addEventListener("click", handleOwnerAction);
  if (adminToken()) showOwnerApp();
}

async function handleLogin(event) {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) return;
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  try {
    const query = filterDate.value ? `?date=${encodeURIComponent(filterDate.value)}` : "";
    bookings = await apiRequest(`/api/bookings${query}`);
    loginWarning.classList.add("hidden");
    showOwnerApp(false);
    renderBookings();
  } catch (error) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    loginWarning.textContent = "Acesso não autorizado";
    loginWarning.classList.remove("hidden");
  }
}

function showOwnerApp(load = true) {
  loginPanel.classList.add("hidden");
  ownerApp.classList.remove("hidden");
  if (load) loadBookings();
}

async function loadBookings() {
  try {
    const query = filterDate.value ? `?date=${encodeURIComponent(filterDate.value)}` : "";
    bookings = await apiRequest(`/api/bookings${query}`);
    warning.classList.add("hidden");
    renderBookings();
  } catch (error) {
    if (error.status === 401) {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
      ownerApp.classList.add("hidden");
      loginPanel.classList.remove("hidden");
      loginWarning.textContent = "Acesso não autorizado";
      loginWarning.classList.remove("hidden");
      return;
    }
    warning.textContent = error.message || "Não foi possível carregar os agendamentos.";
    warning.classList.remove("hidden");
    bookingsBody.innerHTML = '<tr><td colspan="5">Falha ao carregar dados.</td></tr>';
  }
}

function renderBookings() {
  const status = filterStatus.value;
  const visible = status ? bookings.filter((booking) => normalizeStatus(booking.status) === status) : bookings;
  if (!visible.length) {
    bookingsBody.innerHTML = '<tr><td colspan="5">Nenhum agendamento encontrado.</td></tr>';
    return;
  }
  bookingsBody.innerHTML = visible.map((booking) => {
    const currentStatus = normalizeStatus(booking.status);
    const service = booking.service_main || booking.service_type || booking.service_name || "Serviço não informado";
    const additional = booking.additional_services || "Sem adicionais";
    const transport = booking.transport_needed ? booking.transport_label || "Sim" : booking.transport_label || "Não";
    const transportAction = booking.transport_needed ? `
      <div class="transport-action">
        <label>Previsão (min)
          <input type="number" min="1" max="1440" inputmode="numeric" data-transport-eta="${escapeHtml(booking.booking_id || booking.id)}" value="${escapeHtml(booking.transport_eta_minutes || "")}" placeholder="Opcional" />
        </label>
        <button type="button" class="status-button" data-transport-id="${escapeHtml(booking.booking_id || booking.id)}">Motorista a caminho</button>
        ${booking.transport_notified_at ? `<small>Último aviso: ${escapeHtml(formatDateTime(booking.transport_notified_at))}</small>` : ""}
      </div>` : "";
    const address = [booking.address, booking.neighborhood, booking.address_complement, booking.reference_point].filter(Boolean).join(" · ");
    const pets = Array.isArray(booking.pets) && booking.pets.length ? booking.pets : [{
      pet_name: booking.pet_name,
      pet_type: booking.pet_type,
      pet_size: booking.pet_size,
      service_type: service
    }];
    const isStay = booking.service_group === "creche" || booking.service_group === "hotel";
    const schedule = isStay
      ? `<strong>Entrada: ${escapeHtml(formatDate(booking.entry_date))}</strong><span>Saída: ${escapeHtml(formatDate(booking.exit_date))}</span>`
      : `<strong>${escapeHtml(booking.scheduled_time || booking.appointment_hour || "")}</strong><span>${escapeHtml(formatDate(booking.scheduled_date || booking.appointment_date))}</span>`;
    const availableStatuses = isStay ? ["Confirmado", "Finalizado"] : STATUSES;
    const meta = [
      ["ID", booking.booking_id || booking.id],
      ["Criado em", formatDateTime(booking.created_at)],
      ["Email", booking.tutor_email || booking.email],
      ["Pelagem", booking.coat_type],
      ["Temperamento", booking.temperament],
      ["Valor estimado", booking.service_price ? formatMoney(booking.service_price) : ""],
      ["Busca", booking.preferred_pickup_time]
    ].filter(([, value]) => value);
    return `
      <tr>
        <td>
          ${schedule}
          <small>${escapeHtml(booking.booking_id || booking.id || "")}</small>
        </td>
        <td>
          ${pets.map((pet) => `<div class="owner-pet"><strong>${escapeHtml(pet.pet_name || "Pet não informado")}</strong><span>${escapeHtml(pet.pet_type || "Pet")} · ${escapeHtml(pet.pet_size || "Porte não informado")} · ${escapeHtml(pet.service_type || service)}</span><small>Pelagem: ${escapeHtml(profileLabel("coat", pet.coat_type))} · Fase: ${escapeHtml(profileLabel("life", pet.life_stage))} · Castrado(a): ${escapeHtml(profileLabel("neutered", pet.neutered_status))}</small></div>`).join("")}
          <span>${escapeHtml(booking.tutor_name || "Tutor não informado")} · WhatsApp: ${escapeHtml(booking.tutor_phone || booking.whatsapp || "Não informado")}</span>
          ${meta.map(([label, value]) => `<small>${escapeHtml(label)}: ${escapeHtml(value)}</small>`).join("")}
        </td>
        <td>
          <strong>${escapeHtml(service)}</strong>
          ${isStay ? `<span>Total: ${escapeHtml(booking.pet_count || pets.length)} pet(s)</span>` : `<span>Duração total: ${escapeHtml(booking.calculated_duration_minutes || "Não informada")} min</span>`}
          <span>Adicionais: ${escapeHtml(additional)}</span>
          <span>Leva e traz: ${escapeHtml(transport)}</span>
          ${transportAction}
          ${address ? `<small>Endereço: ${escapeHtml(address)}</small>` : ""}
          ${booking.address_complement ? `<small>Complemento: ${escapeHtml(booking.address_complement)}</small>` : ""}
          ${booking.notes ? `<small>Obs.: ${escapeHtml(booking.notes)}</small>` : ""}
        </td>
        <td><span class="status-pill status-${slug(currentStatus)}">${escapeHtml(currentStatus)}</span></td>
        <td><div class="status-actions">${availableStatuses.map((nextStatus) => `<button type="button" class="status-button" data-id="${escapeHtml(booking.booking_id || booking.id)}" data-status="${escapeHtml(nextStatus)}" ${nextStatus === currentStatus ? "disabled" : ""}>${escapeHtml(nextStatus)}</button>`).join("")}</div></td>
      </tr>`;
  }).join("");
}

async function handleOwnerAction(event) {
  const transportButton = event.target.closest("button[data-transport-id]");
  if (transportButton) {
    const bookingId = transportButton.dataset.transportId;
    const etaInput = bookingsBody.querySelector(`[data-transport-eta="${CSS.escape(bookingId)}"]`);
    const eta = etaInput?.value.trim() || null;
    transportButton.disabled = true;
    try {
      await apiRequest(`/api/bookings/${encodeURIComponent(bookingId)}/transport-status`, {
        method: "POST",
        body: JSON.stringify({ transport_status: "motorista_a_caminho", transport_eta_minutes: eta })
      });
      warning.classList.add("hidden");
      await loadBookings();
    } catch (error) {
      warning.textContent = error.status === 401 ? "Acesso não autorizado" : error.message || "Não foi possível enviar o aviso de transporte.";
      warning.classList.remove("hidden");
      transportButton.disabled = false;
    }
    return;
  }
  const button = event.target.closest("button[data-id][data-status]");
  if (!button) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/bookings/${encodeURIComponent(button.dataset.id)}`, { method: "PATCH", body: JSON.stringify({ status: button.dataset.status }) });
    await loadBookings();
  } catch (error) {
    warning.textContent = error.status === 401 ? "Acesso não autorizado" : error.message || "Não foi possível atualizar o status.";
    warning.classList.remove("hidden");
    button.disabled = false;
  }
}

async function exportCsv() {
  exportButton.disabled = true;
  try {
    const response = await fetch(`${API_BASE_URL}/api/bookings/export.csv`, { headers: { "x-petclube-admin-token": adminToken() } });
    if (!response.ok) throw await responseError(response);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "pet_intelligence_bookings.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    warning.textContent = error.status === 401 ? "Acesso não autorizado" : error.message || "Não foi possível exportar o CSV.";
    warning.classList.remove("hidden");
  } finally {
    exportButton.disabled = false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { "Content-Type": "application/json", "x-petclube-admin-token": adminToken(), ...(options.headers || {}) }, ...options });
  if (!response.ok) throw await responseError(response);
  if (response.status === 204) return null;
  return response.json();
}

async function responseError(response) {
  const detail = await response.json().catch(() => ({}));
  const error = new Error(detail.error || `Erro HTTP ${response.status}`);
  error.status = response.status;
  return error;
}

function adminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || "";
}

function normalizeStatus(status) {
  if (STATUSES.includes(status)) return status;
  if (status === "Recebido") return "Novo";
  if (status === "Concluído") return "Finalizado";
  return "Novo";
}

function formatDate(value) {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(number);
}

function slug(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function profileLabel(kind, value) {
  const labels = { coat: { short:"Pelo curto",medium:"Pelo médio ou semilongo",long_straight:"Pelo longo liso ou sedoso",long_wavy:"Pelo longo ondulado",curly:"Pelo cacheado ou encaracolado",double:"Dupla pelagem",wire:"Pelo duro ou pelo de arame",corded:"Pelagem encordoada ou peculiar",hairless:"Sem pelo",other:"Outro",unknown:"Não sei informar" }, life: { puppy:"Filhote",adult:"Adulto",senior:"Idoso",unknown:"Não sei informar" }, neutered: { yes:"Sim",no:"Não",unknown:"Não sei informar" } };
  return labels[kind][value] || value || "Não informado";
}
