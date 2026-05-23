async function copyNumber(button) {
  const card = button.closest(".card");
  const numberEl = card?.querySelector(".number");
  const text = numberEl?.innerText?.trim();

  if (!text) {
    console.warn("Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);

    button.classList.add("copied");
    const original = button.textContent;
    button.textContent = "✓";

    setTimeout(() => {
      button.classList.remove("copied");
      button.textContent = original;
    }, 2000);
  } catch (err) {
    console.error("Clipboard failed:", err);
    button.classList.add("error");
    setTimeout(() => button.classList.remove("error"), 2000);
  }
}

const glow = document.querySelector(".background-glow");
const cards = document.querySelectorAll(".card");

if (glow) {
  document.addEventListener("mousemove", (e) => {
    const cursorX = e.clientX;
    const cursorY = e.clientY;

    glow.style.left = cursorX + "px";
    glow.style.top = cursorY + "px";

    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardCenterX = rect.left + rect.width / 2;
      const cardCenterY = rect.top + rect.height / 2;

      const distanceX = cursorX - cardCenterX;
      const distanceY = cursorY - cardCenterY;
      const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

      const maxDistance = 350;
      const intensity = Math.max(0, 1 - distance / maxDistance);

      if (intensity > 0.1) {
        const length = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        const dirX = (distanceX / length) * intensity;
        const dirY = (distanceY / length) * intensity;

        card.style.setProperty("--glow-x", `${dirX * 15}px`);
        card.style.setProperty("--glow-y", `${dirY * 15}px`);
        card.style.setProperty("--glow-intensity", intensity * 0.4);
        card.classList.add("card-glow-active");
      } else {
        card.classList.remove("card-glow-active");
      }
    });
  });
}

const popup = document.getElementById("popup");

function openCredits() {
  popup?.classList.add("active");
}

function closeCredits() {
  popup?.classList.remove("active");
}

popup?.addEventListener("click", (event) => {
  if (event.target === popup) {
    closeCredits();
  }
});
