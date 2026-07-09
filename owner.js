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
  bookingsBody.addEventListener("click", handleStatusClick);
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
    const address = [booking.address, booking.neighborhood, booking.address_complement, booking.reference_point].filter(Boolean).join(" · ");
    return `
      <tr>
        <td><strong>${escapeHtml(booking.scheduled_time || booking.appointment_hour || "")}</strong><span>${escapeHtml(formatDate(booking.scheduled_date || booking.appointment_date))}</span></td>
        <td>
          <strong>${escapeHtml(booking.pet_name || "Pet não informado")}</strong>
          <span>${escapeHtml(booking.pet_type || "Tipo não informado")} · ${escapeHtml(booking.pet_size || "Porte não informado")}</span>
          <span>${escapeHtml(booking.tutor_name || "Tutor não informado")} · WhatsApp: ${escapeHtml(booking.tutor_phone || booking.whatsapp || "Não informado")}</span>
        </td>
        <td>
          <strong>${escapeHtml(service)}</strong>
          <span>Adicionais: ${escapeHtml(additional)}</span>
          <span>Leva e traz: ${escapeHtml(transport)}</span>
          ${address ? `<small>${escapeHtml(address)}</small>` : ""}
          ${booking.notes ? `<small>Obs.: ${escapeHtml(booking.notes)}</small>` : ""}
        </td>
        <td><span class="status-pill status-${slug(currentStatus)}">${escapeHtml(currentStatus)}</span></td>
        <td><div class="status-actions">${STATUSES.map((nextStatus) => `<button type="button" class="status-button" data-id="${escapeHtml(booking.booking_id || booking.id)}" data-status="${escapeHtml(nextStatus)}" ${nextStatus === currentStatus ? "disabled" : ""}>${escapeHtml(nextStatus)}</button>`).join("")}</div></td>
      </tr>`;
  }).join("");
}

async function handleStatusClick(event) {
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

function slug(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
