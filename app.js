const API_BASE_URL = (window.PETCLUB_API_URL || "https://api.petintelligence.com.br").replace(/\/$/, "");
const CUSTOMER_PROFILE_KEY = "pet_clube_customer_profiles";
const CUSTOMER_HISTORY_KEY = "pet_clube_customer_history";

// Altere os servicos e precos aqui quando a tabela comercial mudar.
const PRIMARY_SERVICES = [
  { id: "banho", name: "Banho", price: 50 },
  { id: "banho-tosa", name: "Banho + Tosa", price: 50 },
  { id: "consulta", name: "Consulta", price: 50 },
  { id: "creche", name: "Creche", price: 50 },
  { id: "hotel", name: "Hotel", price: 50 }
];

const ADDITIONAL_SERVICES = [
  { id: "tosa-higienica", name: "Tosa Higiênica", price: 15 },
  { id: "hidratacao", name: "Hidratação", price: 15 }
];


let currentStep = 0;
let selectedPrimaryService = PRIMARY_SERVICES[0];

const form = document.querySelector("#booking-form");
const stepTabs = [...document.querySelectorAll(".step-tab")];
const stepPanels = [...document.querySelectorAll(".form-step")];
const primaryOptions = document.querySelector("#primary-service-options");
const additionalOptions = document.querySelector("#additional-service-options");
const transportOption = document.querySelector("#transport-option");
const transportFields = document.querySelector("#transport-fields");
const dateInput = document.querySelector("#appointment-date");
const hourSelect = document.querySelector("#appointment-hour");
const dateMessage = document.querySelector("#date-message");
const warning = document.querySelector("#api-warning");
const success = document.querySelector("#success-message");
const backButton = document.querySelector("#back-button");
const nextButton = document.querySelector("#next-button");
const confirmButton = document.querySelector("#confirm-button");
const summary = document.querySelector("#booking-summary");
const additionalPets = document.querySelector("#additional-pets");
const addPetButton = document.querySelector("#add-pet");
const timedDateFields = document.querySelector("#timed-date-fields");
const rangeDateFields = document.querySelector("#range-date-fields");
const entryDateInput = document.querySelector("#entry-date");
const exitDateInput = document.querySelector("#exit-date");

init();

function init() {
  renderPrimaryServices();
  renderAdditionalServices();
  dateInput.min = todayInSaoPaulo();
  dateInput.value = dateInput.min;
  entryDateInput.min = dateInput.min;
  exitDateInput.min = dateInput.min;
  entryDateInput.value = dateInput.min;
  exitDateInput.value = dateInput.min;
  stepTabs.forEach((tab) => tab.addEventListener("click", () => navigateToStep(Number(tab.dataset.step))));
  nextButton.addEventListener("click", nextStep);
  backButton.addEventListener("click", () => goToStep(Math.max(currentStep - 1, 0)));
  form.addEventListener("submit", submitBooking);
  form.addEventListener("input", () => success.classList.add("hidden"));
  transportOption.addEventListener("change", updateTransportFields);
  dateInput.addEventListener("change", loadAvailability);
  addPetButton.addEventListener("click", addPet);
  additionalPets.addEventListener("click", (event) => {
    const button = event.target.closest(".remove-pet");
    if (button) { button.closest(".additional-pet").remove(); renumberAdditionalPets(); updateBookingMode(); }
  });
  additionalPets.addEventListener("change", updateBookingMode);
  updateTransportFields();
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
      updateBookingMode();
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
      if (currentStep === 5) renderSummary();
    });
  });
}

function nextStep() {
  if (!validateCurrentStep()) return;
  goToStep(Math.min(currentStep + 1, 5));
}

function navigateToStep(targetStep) {
  if (targetStep <= currentStep) {
    goToStep(targetStep);
    return;
  }
  while (currentStep < targetStep) {
    if (!validateCurrentStep()) return;
    goToStep(currentStep + 1);
  }
}

function validateCurrentStep() {
  const fields = [...stepPanels[currentStep].querySelectorAll("input, select, textarea")];
  if (!fields.every((field) => field.reportValidity())) return false;
  const mode = bookingMode();
  if (currentStep === 4 && mode.group !== "timed" && exitDateInput.value < entryDateInput.value) {
    warning.textContent = "A data de saída não pode ser anterior à data de entrada.";
    warning.classList.remove("hidden");
    return false;
  }
  warning.classList.add("hidden");
  return true;
}

function goToStep(step) {
  currentStep = step;
  stepTabs.forEach((tab) => tab.classList.toggle("active", Number(tab.dataset.step) === step));
  stepPanels.forEach((panel) => panel.classList.toggle("active", Number(panel.dataset.stepPanel) === step));
  backButton.disabled = step === 0;
  nextButton.classList.toggle("hidden", step === 5);
  confirmButton.classList.toggle("hidden", step !== 5);
  if (step === 5) renderSummary();
  document.querySelector(".step-layout").scrollIntoView({ behavior: "smooth", block: "start" });
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

async function loadAvailability() {
  if (bookingMode().group !== "timed") return;
  hourSelect.innerHTML = "<option value=\"\">Carregando horários...</option>";
  try {
    const availability = await apiRequest(`/api/availability?date=${encodeURIComponent(dateInput.value)}&duration_minutes=${totalDuration()}`);
    warning.classList.add("hidden");
    renderAvailability(availability);
  } catch (error) {
    hourSelect.innerHTML = "<option value=\"\">Não foi possível carregar</option>";
    warning.textContent = error.message || "Não foi possível carregar os horários disponíveis.";
    warning.classList.remove("hidden");
  }
}

function renderAvailability(availability) {
  renderSlots(Array.isArray(availability.slots) ? availability.slots : []);
}

function renderSlots(slots) {
  if (!slots.length) {
    hourSelect.innerHTML = '<option value="">Nenhum horário disponível</option>';
    return;
  }
  hourSelect.innerHTML = ['<option value="">Selecione um horário</option>', ...slots.map((slot) => {
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
  const dateText = payload.service_group === "timed"
    ? `${formatDate(payload.appointment_date)} às ${payload.appointment_hour || "Não informado"} · ${payload.calculated_duration_minutes} min`
    : `${formatDate(payload.entry_date)} a ${formatDate(payload.exit_date)} · ${payload.pet_count} pet(s)`;
  const transportDetails = [payload.address, payload.address_complement, payload.neighborhood, payload.reference_point, payload.location_link].filter(Boolean).join(" · ");
  const items = [
    ["Tutor", `${payload.tutor_name} | ${payload.whatsapp}`],
    ["Pets", payload.pets.map((pet) => `${pet.pet_name} | ${pet.pet_size} | ${pet.service_type}`).join(" · ")],
    ["Serviços adicionais", additionalText],
    [payload.service_group === "timed" ? "Data, horário e duração" : "Entrada, saída e quantidade", dateText],
    ["Leva e traz", payload.transport_label],
    ["Observações", payload.notes || "Sem observações"]
  ];
  if (payload.transport_needed) items.splice(5, 0, ["Endereço do leva e traz", transportDetails]);
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
    saveCustomerData(payload);
    success.classList.remove("hidden");
    resetForm();
    goToStep(0);
    success.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    if (error.status === 409) {
      warning.textContent = error.message || "Não foi possível concluir o agendamento.";
      warning.classList.remove("hidden");
      if (payload.service_group === "timed") await loadAvailability();
      return;
    }
    warning.textContent = error.message || "Não foi possível enviar o agendamento.";
    warning.classList.remove("hidden");
  } finally {
    confirmButton.disabled = false;
    confirmButton.textContent = "Confirmar Agendamento";
  }
}

function buildPayload() {
  const data = Object.fromEntries(new FormData(form).entries());
  const additional = selectedAdditionalServices();
  const additionalNames = additional.map((service) => service.name);
  const transportNeeded = data.transport_option !== "Não, vou levar até a loja";
  const notesParts = [data.notes || ""];
  if (additionalNames.length) notesParts.push(`Serviços adicionais: ${additionalNames.join(", ")}.`);
  if (transportNeeded) notesParts.push(`Leva e traz: ${data.transport_option}.`);
  const pets = currentPets(data);
  const mode = bookingMode(pets);
  return {
    tutor_name: data.tutor_name,
    whatsapp: data.whatsapp,
    email: data.email || "",
    pet_name: data.pet_name,
    pet_type: data.pet_type,
    pet_size: data.pet_size,
    coat_type: data.coat_type || "Curta",
    pets,
    pet_count: pets.length,
    temperament: "Não informado",
    service_type: selectedPrimaryService.name,
    service_group: mode.group,
    additional_services: additionalNames,
    calculated_duration_minutes: mode.group === "timed" ? totalDuration(pets) : null,
    transport_needed: transportNeeded,
    transport_label: data.transport_option,
    appointment_date: mode.group === "timed" ? data.appointment_date : "",
    appointment_hour: mode.group === "timed" ? data.appointment_hour : "",
    entry_date: mode.group === "timed" ? "" : data.entry_date,
    exit_date: mode.group === "timed" ? "" : data.exit_date,
    status: "Novo",
    notes: notesParts.filter(Boolean).join(" ").trim(),
    address: transportNeeded ? data.address || "" : "",
    address_complement: transportNeeded ? data.address_complement || "" : "",
    neighborhood: transportNeeded ? data.neighborhood || "" : "",
    reference_point: transportNeeded ? data.reference_point || "" : "",
    location_link: transportNeeded ? data.location_link || "" : ""
  };
}

function selectedAdditionalServices() {
  const ids = [...additionalOptions.querySelectorAll('input[name="additional_services"]:checked')].map((input) => input.value);
  return ADDITIONAL_SERVICES.filter((service) => ids.includes(service.id));
}

function resetForm() {
  form.reset();
  additionalPets.innerHTML = "";
  selectedPrimaryService = PRIMARY_SERVICES[0];
  primaryOptions.querySelectorAll(".service-card").forEach((card, index) => card.classList.toggle("active", index === 0));
  dateInput.value = dateInput.min;
  entryDateInput.value = entryDateInput.min;
  exitDateInput.value = exitDateInput.min;
  updateTransportFields();
  updateBookingMode();
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
    primary_service_id: selectedPrimaryService.id
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
    const error = new Error(detail.error || `Erro HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json().catch(() => ({}));
}


function addPet() {
  const index = additionalPets.children.length + 2;
  additionalPets.insertAdjacentHTML("beforeend", `
    <fieldset class="additional-pet">
      <legend>Pet ${index}</legend>
      <div class="field-grid two">
        <label>Nome do pet<input name="extra_pet_name" required placeholder="Ex.: Luna" /></label>
        <label>Tipo do pet<select name="extra_pet_type" required><option>Cachorro</option><option>Gato</option><option>Outro</option></select></label>
        <label>Porte<select name="extra_pet_size" required><option>Pequeno</option><option>Médio</option><option>Grande</option><option>Gigante</option></select></label>
        <label>Tipo de pelagem<select name="extra_pet_coat" required><option value="Curta">Curta</option><option value="Longa">Longa</option></select></label>
        <label>Observações opcionais<input name="extra_pet_notes" /></label>
      </div>
      <button type="button" class="button secondary remove-pet">Remover pet</button>
    </fieldset>`);
  renumberAdditionalPets();
  updateBookingMode();
}

function renumberAdditionalPets() {
  additionalPets.querySelectorAll(".additional-pet").forEach((pet, position) => {
    pet.querySelector("legend").textContent = `Pet ${position + 2}`;
  });
}

function currentPets(data = Object.fromEntries(new FormData(form).entries())) {
  const pets = [{
    pet_name: data.pet_name,
    pet_type: data.pet_type,
    pet_size: data.pet_size,
    coat_type: data.coat_type || "Curta",
    service_type: selectedPrimaryService.name,
    life_stage: "",
    neutered_status: "",
    notes: data.notes || "",
    temperament: "Não informado"
  }];
  additionalPets.querySelectorAll(".additional-pet").forEach((container) => {
    pets.push({
      pet_name: container.querySelector('[name="extra_pet_name"]').value,
      pet_type: container.querySelector('[name="extra_pet_type"]').value,
      pet_size: container.querySelector('[name="extra_pet_size"]').value,
      coat_type: container.querySelector('[name="extra_pet_coat"]').value,
      life_stage: "",
      neutered_status: "",
      service_type: selectedPrimaryService.name,
      notes: container.querySelector('[name="extra_pet_notes"]').value,
      temperament: "Não informado"
    });
  });
  return pets;
}

function serviceGroup(service) {
  if (service === "Creche") return "creche";
  if (service === "Hotel") return "hotel";
  return "timed";
}

function bookingMode() {
  return { group: serviceGroup(selectedPrimaryService.name) };
}

function durationForPet(pet) {
  if (pet.service_type === "Consulta") return 30;
  const size = pet.pet_size;
  const table = pet.service_type === "Banho"
    ? { Pequeno: 30, Médio: 45, Grande: 45, Gigante: 60 }
    : { Pequeno: 45, Médio: 60, Grande: 60, Gigante: 90 };
  return table[size] || 0;
}

function totalDuration(pets = currentPets()) {
  return pets.reduce((total, pet) => total + durationForPet(pet), 0);
}

function updateBookingMode() {
  const mode = bookingMode();
  const isTimed = mode.group === "timed";
  timedDateFields.classList.toggle("hidden", !isTimed);
  rangeDateFields.classList.toggle("hidden", isTimed);
  dateInput.required = isTimed;
  hourSelect.required = isTimed;
  entryDateInput.required = !isTimed;
  exitDateInput.required = !isTimed;
  document.querySelector(".business-hours-box").classList.toggle("hidden", !isTimed);
  dateMessage.textContent = isTimed ? "" : "A capacidade é validada para todo o período selecionado.";
  dateMessage.classList.remove("warning-text");
  if (isTimed) loadAvailability();
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

function todayInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const datePart = (type) => parts.find((part) => part.type === type).value;
  return `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
}

function formatPrice(value) {
  const amount = Number(value).toFixed(2).replace(".", ",");
  return `R$ ${amount}`;
}

function formatDate(value) {
  if (!value) return "Não informada";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
