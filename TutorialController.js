// ui/TutorialController.js
export class TutorialController {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.slides = [];
    this.index = 0;
  }

  start(slides) {
    this.slides = slides;
    this.index = 0;
    this.render();
  }

  next() {
    if (this.index < this.slides.length - 1) {
      this.index++;
      this.render();
    }
  }

  render() {
    const slide = this.slides[this.index];
    const progress = ((this.index + 1) / this.slides.length) * 100;

    this.container.innerHTML = `
      <div class="tutorial-wrapper">
        <div class="tutorial-card">

          <div class="tutorial-header">
            <div class="tutorial-step">
              Kapitel ${this.index + 1} von ${this.slides.length}
            </div>
            <h2>${slide.title}</h2>
          </div>

          <div class="tutorial-content">
            <p class="tutor-text">
              ${slide.text}
            </p>

            <div class="tutor-hint">
              💡 Tutor-Hinweis: ${slide.hint}
            </div>
          </div>

          <div class="tutorial-footer">
            <button class="tutorial-next" ${this.index === this.slides.length - 1 ? "disabled" : ""}>
              Weiter →
            </button>
          </div>

          <div class="tutorial-progress">
            <div class="tutorial-progress-bar" style="width:${progress}%"></div>
          </div>

        </div>
      </div>
    `;

    const nextBtn = this.container.querySelector(".tutorial-next");
    if (nextBtn) {
      nextBtn.onclick = () => this.next();
    }
  }
}
