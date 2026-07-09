const API_BASE_URL = (window.PETCLUB_API_URL || "").replace(/\/$/, "");
const STATUSES = ["Novo", "Confirmado", "Em atendimento", "Pronto", "Finalizado", "Cancelado"];

let bookings = [];

const filterDate = document.querySelector("#filter-date");
const filterStatus = document.querySelector("#filter-status");
const bookingsBody = document.querySelector("#bookings-body");
const warning = document.querySelector("#owner-warning");

init();

async function init() {
  filterDate.value = new Date().toISOString().slice(0, 10);
  filterStatus.innerHTML = ['<option value="">Todos</option>', ...STATUSES.map((status) => `<option>${escapeHtml(status)}</option>`)].join("");
  filterDate.addEventListener("change", loadBookings);
  filterStatus.addEventListener("change", renderBookings);
  bookingsBody.addEventListener("click", handleStatusClick);
  await loadBookings();
}

async function loadBookings() {
  try {
    const query = filterDate.value ? `?date=${encodeURIComponent(filterDate.value)}` : "";
    bookings = await apiRequest(`/api/bookings${query}`);
    warning.classList.add("hidden");
    renderBookings();
  } catch (error) {
    warning.textContent = "Não foi possível carregar os agendamentos.";
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
    return `
      <tr>
        <td><strong>${escapeHtml(booking.appointment_hour)}</strong><span>${formatDate(booking.appointment_date)}</span></td>
        <td><strong>${escapeHtml(booking.pet_name)}</strong><span>${escapeHtml(booking.tutor_name)} · ${escapeHtml(booking.whatsapp)}</span>${booking.notes ? `<small>${escapeHtml(booking.notes)}</small>` : ""}</td>
        <td><strong>${escapeHtml(booking.service_name || booking.service_type)}</strong><span>${escapeHtml(booking.pet_type || booking.pet_size || "Tipo não informado")}</span></td>
        <td><span class="status-pill status-${slug(currentStatus)}">${escapeHtml(currentStatus)}</span></td>
        <td><div class="status-actions">${STATUSES.map((nextStatus) => `<button type="button" class="status-button" data-id="${escapeHtml(booking.booking_id)}" data-status="${escapeHtml(nextStatus)}" ${nextStatus === currentStatus ? "disabled" : ""}>${escapeHtml(nextStatus)}</button>`).join("")}</div></td>
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
    warning.textContent = error.message || "Não foi possível atualizar o status.";
    warning.classList.remove("hidden");
    button.disabled = false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Erro HTTP ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function normalizeStatus(status) {
  if (STATUSES.includes(status)) return status;
  if (status === "Recebido") return "Novo";
  if (status === "Concluído") return "Finalizado";
  return "Novo";
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function slug(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
