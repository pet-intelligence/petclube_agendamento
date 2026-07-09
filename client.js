const API_BASE_URL = (window.PETCLUB_API_URL || "https://api.petintelligence.com.br").replace(/\/$/, "");
const CUSTOMER_PROFILE_KEY = "pet_clube_customer_profiles";
const CUSTOMER_HISTORY_KEY = "pet_clube_customer_history";
const PENDING_BOOKINGS_KEY = "pet_clube_pending_bookings";

// Altere os servicos e precos aqui quando a tabela comercial mudar.
const PRIMARY_SERVICES = [
  { id: "banho", name: "Banho", price: 50 },
  { id: "banho-tosa", name: "Banho + Tosa", price: 50 },
  { id: "consulta", name: "Consulta", price: 50 },
  { id: "creche", name: "Creche", price: 50 },
  { id: "hotel", name: "Hotel", price: 50 }
];

const ADDITIONAL_SERVICES = [
  { id: "dog-taxi", name: "Dog Taxi", price: 15 },
  { id: "tosa-higienica", name: "Tosa Higiênica", price: 15 },
  { id: "hidratacao", name: "Hidratação", price: 15 }
];

const BUSINESS_HOURS = {
  1: { label: "Segunda", open: "09:00", close: "17:30" },
  2: { label: "Terça", open: "09:00", close: "17:30" },
  3: { label: "Quarta", open: "09:00", close: "17:30" },
  4: { label: "Quinta", open: "09:00", close: "17:30" },
  5: { label: "Sexta", open: "09:00", close: "17:30" },
  6: { label: "Sábado", open: "09:00", close: "16:30" },
  0: { label: "Domingo", closed: true }
};

let currentStep = 0;
let selectedPrimaryService = PRIMARY_SERVICES[0];

const form = document.querySelector("#booking-form");
const stepTabs = [...document.querySelectorAll(".step-tab")];
const stepPanels = [...document.querySelectorAll(".form-step")];
const primaryOptions = document.querySelector("#primary-service-options");
const additionalOptions = document.querySelector("#additional-service-options");
const returningCustomer = document.querySelector("#returning-customer");
const knownClientBox = document.querySelector("#known-client-box");
const knownClientMessage = document.querySelector("#known-client-message");
const loadKnownClientButton = document.querySelector("#load-known-client");
const transportOption = document.querySelector("#transport-option");
const transportFields = document.querySelector("#transport-fields");
const dogTaxiNote = document.querySelector("#dog-taxi-note");
const dateInput = document.querySelector("#appointment-date");
const hourSelect = document.querySelector("#appointment-hour");
const dateMessage = document.querySelector("#date-message");
const warning = document.querySelector("#api-warning");
const success = document.querySelector("#success-message");
const backButton = document.querySelector("#back-button");
const nextButton = document.querySelector("#next-button");
const confirmButton = document.querySelector("#confirm-button");
const summary = document.querySelector("#booking-summary");

init();

function init() {
  renderPrimaryServices();
  renderAdditionalServices();
  dateInput.min = new Date().toISOString().slice(0, 10);
  dateInput.value = dateInput.min;
  stepTabs.forEach((tab) => tab.addEventListener("click", () => goToStep(Number(tab.dataset.step))));
  nextButton.addEventListener("click", nextStep);
  backButton.addEventListener("click", () => goToStep(Math.max(currentStep - 1, 0)));
  form.addEventListener("submit", submitBooking);
  returningCustomer.addEventListener("change", updateKnownClientVisibility);
  loadKnownClientButton.addEventListener("click", loadKnownClient);
  transportOption.addEventListener("change", updateTransportFields);
  dateInput.addEventListener("change", loadAvailability);
  updateKnownClientVisibility();
  updateTransportFields();
  updateDogTaxiNote();
  loadAvailability();
  goToStep(0);
}

function renderPrimaryServices() {
  primaryOptions.innerHTML = PRIMARY_SERVICES.map((service, index) => `
    <button type="button" class="service-card ${index === 0 ? "active" : ""}" data-service-id="${escapeHtml(service.id)}">
      <strong>${escapeHtml(service.name)}</strong>
      <small>A partir de ${formatPrice(service.price)}</small>
    </button>
  `).join("");

  primaryOptions.querySelectorAll(".service-card").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPrimaryService = PRIMARY_SERVICES.find((service) => service.id === button.dataset.serviceId) || PRIMARY_SERVICES[0];
      primaryOptions.querySelectorAll(".service-card").forEach((card) => card.classList.remove("active"));
      button.classList.add("active");
      if (currentStep === 5) renderSummary();
    });
  });
}

function renderAdditionalServices() {
  additionalOptions.innerHTML = ADDITIONAL_SERVICES.map((service) => `
    <label class="addon-card">
      <input type="checkbox" name="additional_services" value="${escapeHtml(service.id)}" />
      <span><strong>${escapeHtml(service.name)}</strong><small>A partir de ${formatPrice(service.price)}</small></span>
    </label>
  `).join("");

  additionalOptions.querySelectorAll("input").forEach((input) => {
    input.addEventListener("change", () => {
      updateDogTaxiNote();
      if (currentStep === 5) renderSummary();
    });
  });
}

function nextStep() {
  if (!validateCurrentStep()) return;
  goToStep(Math.min(currentStep + 1, 5));
}

function validateCurrentStep() {
  const fields = [...stepPanels[currentStep].querySelectorAll("input, select, textarea")];
  return fields.every((field) => field.reportValidity());
}

function goToStep(step) {
  currentStep = step;
  stepTabs.forEach((tab) => tab.classList.toggle("active", Number(tab.dataset.step) === step));
  stepPanels.forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.stepPanel) === step));
  backButton.disabled = step === 0;
  nextButton.classList.toggle("hidden", step === 5);
  confirmButton.classList.toggle("hidden", step !== 5);
  success.classList.add("hidden");
  if (step === 5) renderSummary();
  document.querySelector(".step-layout").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateKnownClientVisibility() {
  knownClientBox.classList.toggle("hidden", returningCustomer.value !== "Sim");
}

function loadKnownClient() {
  const phone = normalizePhone(form.elements.whatsapp.value);
  if (!phone) {
    knownClientMessage.textContent = "Informe o WhatsApp para buscar dados salvos.";
    return;
  }
  const profiles = readStorage(CUSTOMER_PROFILE_KEY, {});
  const profile = profiles[phone];
  if (!profile) {
    knownClientMessage.textContent = "Nenhum dado salvo neste navegador para este WhatsApp.";
    return;
  }
  form.elements.tutor_name.value = profile.tutor_name || form.elements.tutor_name.value;
  form.elements.email.value = profile.email || "";
  form.elements.pet_name.value = profile.pet_name || "";
  form.elements.pet_type.value = profile.pet_type || "Cachorro";
  form.elements.pet_size.value = profile.pet_size || "Pequeno";
  form.elements.notes.value = profile.notes || "";
  if (profile.primary_service_id) selectPrimaryService(profile.primary_service_id);
  knownClientMessage.textContent = historyTextFor(phone);
}

function selectPrimaryService(serviceId) {
  const button = primaryOptions.querySelector(`[data-service-id="${CSS.escape(serviceId)}"]`);
  if (!button) return;
  selectedPrimaryService = PRIMARY_SERVICES.find((service) => service.id === serviceId) || selectedPrimaryService;
  primaryOptions.querySelectorAll(".service-card").forEach((card) => card.classList.remove("active"));
  button.classList.add("active");
}

function updateTransportFields() {
  const needsTransport = transportOption.value !== "Não, vou levar até a loja";
  transportFields.classList.toggle("hidden", !needsTransport);
  transportFields.querySelectorAll("input").forEach((input) => {
    input.required = needsTransport && input.name === "address";
    if (!needsTransport) input.value = "";
  });
}

function updateDogTaxiNote() {
  dogTaxiNote.classList.toggle("hidden", !selectedAdditionalServices().some((service) => service.id === "dog-taxi"));
}

async function loadAvailability() {
  updateDateMessage();
  hourSelect.innerHTML = '<option value="">Carregando horários...</option>';
  try {
    const availability = await apiRequest(`/api/availability?date=${encodeURIComponent(dateInput.value)}`);
    warning.classList.add("hidden");
    renderSlots(availability.slots || []);
  } catch (error) {
    warning.textContent = "Backend indisponível. O formulário continua aberto, mas a disponibilidade não pode ser confirmada agora.";
    warning.classList.remove("hidden");
    renderSlots(defaultSlotsForDate(dateInput.value).map((time) => ({ time, available: true })));
  }
}

function updateDateMessage() {
  const hours = BUSINESS_HOURS[dayOfWeek(dateInput.value)];
  if (!hours) {
    dateMessage.textContent = "";
    return;
  }
  dateMessage.textContent = hours.closed
    ? "Domingo estamos fechados. Escolha outro dia para agilizar a confirmação."
    : `${hours.label}: atendimento das ${hours.open} às ${hours.close}.`;
  dateMessage.classList.toggle("warning-text", Boolean(hours.closed));
}

function renderSlots(slots) {
  const visibleSlots = slots.length ? slots : defaultSlotsForDate(dateInput.value).map((time) => ({ time, available: true }));
  if (!visibleSlots.length) {
    hourSelect.innerHTML = '<option value="">Nenhum horário disponível</option>';
    return;
  }
  hourSelect.innerHTML = ['<option value="">Selecione um horário</option>', ...visibleSlots.map((slot) => {
    const label = slot.available ? slot.time : `${slot.time} - indisponível`;
    return `<option value="${escapeHtml(slot.time)}" ${slot.available ? "" : "disabled"}>${escapeHtml(label)}</option>`;
  })].join("");
}

function renderSummary() {
  const payload = buildPayload();
  const additional = selectedAdditionalServices();
  const additionalText = additional.length
    ? additional.map((service) => `${service.name} (${formatPrice(service.price)})`).join(", ")
    : "Nenhum adicional";
  const items = [
    ["Tutor", `${payload.tutor_name} | ${payload.whatsapp}`],
    ["Pet", `${payload.pet_name} | ${payload.pet_type} | ${payload.pet_size}`],
    ["Serviço principal", `${selectedPrimaryService.name} (${formatPrice(selectedPrimaryService.price)})`],
    ["Serviços adicionais", additionalText],
    ["Data e horário", `${formatDate(payload.appointment_date)} às ${payload.appointment_hour || "Não informado"}`],
    ["Leva e traz", payload.transport_label],
    ["Observações", payload.notes || "Sem observações"]
  ];
  summary.innerHTML = items.map(([label, value]) => `
    <div class="summary-item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
  `).join("");
}

async function submitBooking(event) {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const payload = buildPayload();
  confirmButton.disabled = true;
  confirmButton.textContent = "Enviando...";
  try {
    await apiRequest("/api/bookings", { method: "POST", body: JSON.stringify(payload) });
    warning.classList.add("hidden");
  } catch (error) {
    savePendingBooking(payload);
    warning.textContent = "Backend indisponível. O pedido foi salvo neste navegador como fallback simples.";
    warning.classList.remove("hidden");
  }
  saveCustomerData(payload);
  success.classList.remove("hidden");
  resetForm();
  confirmButton.disabled = false;
  confirmButton.textContent = "Confirmar agendamento";
  goToStep(0);
  success.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildPayload() {
  const data = Object.fromEntries(new FormData(form).entries());
  const additional = selectedAdditionalServices();
  const additionalNames = additional.map((service) => service.name);
  const transportNeeded = data.transport_option !== "Não, vou levar até a loja";
  const notesParts = [data.notes || ""];
  if (additionalNames.length) notesParts.push(`Serviços adicionais: ${additionalNames.join(", ")}.`);
  if (transportNeeded) notesParts.push(`Leva e traz: ${data.transport_option}.`);
  return {
    tutor_name: data.tutor_name,
    whatsapp: data.whatsapp,
    email: data.email || "",
    pet_name: data.pet_name,
    pet_type: data.pet_type,
    pet_size: data.pet_size,
    coat_type: "Não informado",
    temperament: "Não informado",
    service_type: selectedPrimaryService.name,
    service_id: selectedPrimaryService.id,
    service_name: selectedPrimaryService.name,
    service_price: selectedPrimaryService.price,
    additional_services: additionalNames.join(", "),
    additional_service_ids: additional.map((service) => service.id).join(","),
    transport_needed: transportNeeded,
    transport_label: data.transport_option,
    appointment_date: data.appointment_date,
    appointment_hour: data.appointment_hour,
    status: "Novo",
    notes: notesParts.filter(Boolean).join(" ").trim(),
    address: transportNeeded ? data.address || "" : "",
    address_complement: transportNeeded ? data.address_complement || "" : "",
    neighborhood: transportNeeded ? data.neighborhood || "" : "",
    reference_point: transportNeeded ? data.reference_point || "" : "",
    location_link: transportNeeded ? data.location_link || "" : "",
    preferred_pickup_time: transportNeeded ? data.preferred_pickup_time || "" : ""
  };
}

function selectedAdditionalServices() {
  const ids = [...additionalOptions.querySelectorAll('input[name="additional_services"]:checked')].map((input) => input.value);
  return ADDITIONAL_SERVICES.filter((service) => ids.includes(service.id));
}

function resetForm() {
  form.reset();
  selectedPrimaryService = PRIMARY_SERVICES[0];
  primaryOptions.querySelectorAll(".service-card").forEach((card, index) => card.classList.toggle("active", index === 0));
  dateInput.value = dateInput.min;
  updateKnownClientVisibility();
  updateTransportFields();
  updateDogTaxiNote();
  loadAvailability();
}

function saveCustomerData(payload) {
  const phone = normalizePhone(payload.whatsapp);
  if (!phone) return;
  const profiles = readStorage(CUSTOMER_PROFILE_KEY, {});
  profiles[phone] = {
    tutor_name: payload.tutor_name,
    whatsapp: payload.whatsapp,
    email: payload.email,
    pet_name: payload.pet_name,
    pet_type: payload.pet_type,
    pet_size: payload.pet_size,
    notes: payload.notes,
    primary_service_id: payload.service_id
  };
  writeStorage(CUSTOMER_PROFILE_KEY, profiles);

  const history = readStorage(CUSTOMER_HISTORY_KEY, {});
  history[phone] = [{ ...payload, saved_at: new Date().toISOString() }, ...(history[phone] || [])].slice(0, 12);
  writeStorage(CUSTOMER_HISTORY_KEY, history);
}

function historyTextFor(phone) {
  const history = readStorage(CUSTOMER_HISTORY_KEY, {});
  const recent = (history[phone] || []).filter(isRecentHistory).slice(0, 6);
  if (!recent.length) return "Dados encontrados. Ainda não há histórico recente salvo neste navegador.";
  return `Dados encontrados. Histórico recente: ${recent.map((item) => `${formatDate(item.appointment_date)} - ${item.service_type}`).join(" | ")}`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Erro HTTP ${response.status}`);
  }
  return response.json();
}

function savePendingBooking(payload) {
  const saved = readStorage(PENDING_BOOKINGS_KEY, []);
  saved.push({ ...payload, saved_at: new Date().toISOString() });
  writeStorage(PENDING_BOOKINGS_KEY, saved);
}

function defaultSlotsForDate(dateText) {
  const hours = BUSINESS_HOURS[dayOfWeek(dateText)];
  if (hours?.closed) return [];
  const endHour = hours && hours.close === "16:30" ? 16 : 17;
  return Array.from({ length: endHour - 8 }, (_, index) => `${String(index + 9).padStart(2, "0")}:00`);
}

function dayOfWeek(dateText) {
  const [year, month, day] = String(dateText).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isRecentHistory(item) {
  const time = new Date(item.saved_at || item.appointment_date).getTime();
  const sixMonths = 1000 * 60 * 60 * 24 * 183;
  return Number.isFinite(time) && Date.now() - time <= sixMonths;
}

function readStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch (error) { return fallback; }
}

function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatPrice(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value) {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
