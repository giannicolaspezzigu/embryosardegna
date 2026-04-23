const introLoginForm = document.querySelector("#introLoginForm");
const loginState = document.querySelector("#loginState");
const cinemaCanvas = document.querySelector("#cinemaCanvas");

const startCinema = () => {
  if (!cinemaCanvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const context = cinemaCanvas.getContext("2d");
  const palette = ["#33f3ff", "#8059ff", "#ff4fa3", "#ffcf52", "#81f772", "#ff7a59"];
  const sparks = Array.from({ length: 76 }, (_, index) => ({
    x: Math.random(),
    y: Math.random(),
    speed: 0.00018 + Math.random() * 0.00045,
    size: 1.4 + Math.random() * 2.8,
    color: palette[index % palette.length],
    phase: Math.random() * Math.PI * 2,
  }));
  let width = 0;
  let height = 0;
  let pixelRatio = 1;

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    cinemaCanvas.width = Math.floor(width * pixelRatio);
    cinemaCanvas.height = Math.floor(height * pixelRatio);
    cinemaCanvas.style.width = `${width}px`;
    cinemaCanvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const drawRibbon = (time, color, yOffset, amplitude, speed) => {
    context.beginPath();
    context.moveTo(-80, height * yOffset);

    for (let x = -80; x <= width + 80; x += 22) {
      const wave = Math.sin(x * 0.008 + time * speed) * amplitude;
      const wave2 = Math.cos(x * 0.004 + time * speed * 0.72) * amplitude * 0.42;
      context.lineTo(x, height * yOffset + wave + wave2);
    }

    context.strokeStyle = color;
    context.lineWidth = 2.2;
    context.shadowColor = color;
    context.shadowBlur = 18;
    context.stroke();
    context.shadowBlur = 0;
  };

  const draw = (time) => {
    context.clearRect(0, 0, width, height);

    context.globalCompositeOperation = "lighter";
    drawRibbon(time * 0.001, "rgba(51, 243, 255, 0.52)", 0.22, 54, 1.4);
    drawRibbon(time * 0.001, "rgba(255, 79, 163, 0.42)", 0.48, 72, 1.05);
    drawRibbon(time * 0.001, "rgba(255, 207, 82, 0.32)", 0.72, 46, 1.22);

    sparks.forEach((spark) => {
      spark.x += spark.speed;
      if (spark.x > 1.08) {
        spark.x = -0.08;
        spark.y = Math.random();
      }

      const x = spark.x * width;
      const y = spark.y * height + Math.sin(time * 0.002 + spark.phase) * 28;
      const alpha = 0.28 + Math.sin(time * 0.003 + spark.phase) * 0.18;

      context.globalAlpha = Math.max(0.08, alpha);
      context.fillStyle = spark.color;
      context.shadowColor = spark.color;
      context.shadowBlur = 12;
      context.fillRect(x, y, spark.size * 4, spark.size);
    });

    context.globalAlpha = 1;
    context.shadowBlur = 0;
    context.globalCompositeOperation = "source-over";
    requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(draw);
};

function setLoginState(message) {
  if (loginState) {
    loginState.textContent = message;
  }
}

async function redirectIfAlreadyAuthenticated() {
  if (!window.EmbryoApp || !window.EmbryoApp.auth || !window.EmbryoApp.auth.isEnabled()) {
    return;
  }

  setLoginState("Verifica sessione attiva...");

  try {
    const session = await window.EmbryoApp.auth.redirectIfAuthenticated();

    if (session) {
      setLoginState("Sessione valida, accesso in corso...");
      return;
    }

    setLoginState("Inserisci le credenziali.");
  } catch (error) {
    console.error(error);
    setLoginState(window.EmbryoApp.auth.getFriendlyErrorMessage(error));
  }
}

if (introLoginForm && loginState) {
  introLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = introLoginForm.querySelector(".login-button");
    const buttonCopy = introLoginForm.querySelector(".button-copy");
    const identifierInput = introLoginForm.querySelector('input[name="identifier"]');
    const passwordInput = introLoginForm.querySelector('input[name="password"]');

    if (!window.EmbryoApp || !window.EmbryoApp.auth || !window.EmbryoApp.auth.isEnabled()) {
      setLoginState("Autenticazione non configurata.");
      return;
    }

    introLoginForm.classList.remove("is-authorized");
    submitButton.classList.add("is-loading");
    submitButton.disabled = true;
    buttonCopy.textContent = "Accesso...";
    setLoginState("Verifica credenziali e profilo clinica...");

    try {
      await window.EmbryoApp.auth.signInWithPassword(identifierInput.value, passwordInput.value);
      introLoginForm.classList.add("is-authorized");
      buttonCopy.textContent = "Accesso consentito";
      setLoginState("Accesso autorizzato, apertura applicazione...");
      window.setTimeout(() => {
        window.location.replace("./embryosardegna.html");
      }, 320);
    } catch (error) {
      console.error(error);
      buttonCopy.textContent = "Accedi";
      setLoginState(window.EmbryoApp.auth.getFriendlyErrorMessage(error));
    } finally {
      submitButton.classList.remove("is-loading");
      submitButton.disabled = false;
    }
  });
}

startCinema();
redirectIfAlreadyAuthenticated();

window.setTimeout(() => {
  document.body.classList.add("is-settled");
}, 4400);
