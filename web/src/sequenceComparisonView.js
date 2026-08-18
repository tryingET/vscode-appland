import Vue from 'vue';
import { VSequenceDiagram } from '@appland/components'; // eslint-disable-line import/no-named-default
import '@appland/diagrams/dist/style.css';

const STYLE = `
  html, body, #app { height: 100%; margin: 0; }
  body { background: #05060a; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  .appmap-comparison { height: 100%; display: grid; grid-template-rows: auto minmax(260px, 1fr) minmax(220px, .72fr); gap: 1px; background: #343746; }
  .appmap-comparison__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 14px; background: #11131b; border-bottom: 1px solid #3e4150; }
  .appmap-comparison__title { min-width: 220px; flex: 1; }
  .appmap-comparison__title strong { display: block; font-size: 14px; }
  .appmap-comparison__title span { color: #a9acb8; font-size: 12px; }
  .appmap-comparison__controls { display: flex; align-items: center; gap: 8px; }
  .appmap-comparison button { border: 1px solid #555a6d; border-radius: 5px; background: #242735; color: #fff; padding: 5px 10px; cursor: pointer; }
  .appmap-comparison button:disabled { cursor: default; opacity: .45; }
  .appmap-comparison__counter { min-width: 108px; text-align: center; font-variant-numeric: tabular-nums; }
  .appmap-comparison__legend { display: flex; align-items: center; gap: 10px; font-size: 12px; color: #c7c9d1; }
  .appmap-comparison__legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
  .appmap-comparison__legend--added i { background: #32c766; }
  .appmap-comparison__legend--removed i { background: #e0525f; }
  .appmap-comparison__legend--changed i { background: #e8b84a; }
  .appmap-comparison__top { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 1px; }
  .appmap-comparison__pane { position: relative; min-width: 0; min-height: 0; background: #05060a; display: grid; grid-template-rows: auto 1fr; }
  .appmap-comparison__pane header { z-index: 2; display: flex; align-items: center; justify-content: space-between; padding: 7px 11px; background: #171924; border-bottom: 1px solid #343746; font-size: 12px; }
  .appmap-comparison__pane header code { color: #aeb7ff; }
  .appmap-comparison__scroller { min-height: 0; overflow: auto; position: relative; }
  .appmap-comparison__ghost { position: absolute; z-index: 5; top: 42px; right: 12px; padding: 5px 8px; border: 1px dashed #6d7185; border-radius: 4px; background: rgba(21, 23, 34, .9); color: #c8cad2; font-size: 11px; pointer-events: none; }
  .appmap-comparison__bottom { min-height: 0; background: #05060a; display: grid; grid-template-rows: auto 1fr; }
  .appmap-comparison__bottom header { display: flex; align-items: center; gap: 10px; padding: 7px 11px; background: #171924; border-bottom: 1px solid #343746; font-size: 12px; }
  .appmap-comparison__change { color: #d8dae3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .appmap-comparison__change[data-kind="added"] { color: #69dd8d; }
  .appmap-comparison__change[data-kind="removed"] { color: #ff7580; }
  .appmap-comparison__change[data-kind="changed"] { color: #f4cf73; }
  .appmap-comparison__empty { display: grid; place-items: center; height: 100%; padding: 30px; color: #a9acb8; text-align: center; }
  .appmap-comparison .call.appmap-comparison-selected > .call-line-segment,
  .appmap-comparison .call.appmap-comparison-selected > .self-call {
    outline: 3px solid #ff27b6 !important;
    outline-offset: 2px;
    background: rgba(255, 39, 182, .34) !important;
  }
  @media (max-width: 900px) {
    .appmap-comparison { grid-template-rows: auto minmax(360px, 1fr) minmax(220px, .65fr); }
    .appmap-comparison__top { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
    .appmap-comparison__legend { display: none; }
  }
`;

function installStyle() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function revisionLabel(value) {
  if (!value) return 'unspecified revision';
  return value.length > 12 ? value.slice(0, 12) : value;
}

export default function mountSequenceComparison() {
  installStyle();
  const vscode = window.acquireVsCodeApi();

  const app = new Vue({
    el: '#app',
    components: { VSequenceDiagram },
    data() {
      return {
        comparison: undefined,
        comparisonKey: 0,
        selectedChangeIndex: 0,
        lockScroll: true,
        synchronizingScroll: false,
      };
    },
    computed: {
      changes() {
        return this.comparison?.changes || [];
      },
      currentChange() {
        return this.changes[this.selectedChangeIndex];
      },
      currentKind() {
        return this.currentChange ? this.currentChange.kind : '';
      },
      scenario() {
        return this.comparison?.scenario || this.comparison?.headAppMap || 'AppMap scenario';
      },
      baseRevision() {
        return revisionLabel(this.comparison?.baseRevision);
      },
      headRevision() {
        return revisionLabel(this.comparison?.headRevision);
      },
      counter() {
        if (!this.changes.length) return 'No changes';
        return `Change ${this.selectedChangeIndex + 1} of ${this.changes.length}`;
      },
      changeDescription() {
        if (!this.currentChange) return 'The recorded call structure is unchanged.';
        const change = this.currentChange;
        if (change.kind === 'changed' && change.formerName && change.formerName !== change.name)
          return `${change.formerName} → ${change.name}`;
        if (
          change.kind === 'changed' &&
          change.formerResult !== undefined &&
          change.result !== undefined &&
          change.formerResult !== change.result
        )
          return `${change.name}: ${change.formerResult} → ${change.result}`;
        return `${change.kind}: ${change.name}`;
      },
      baseGhost() {
        return this.currentChange && this.currentChange.baseEventIds.length === 0;
      },
      headGhost() {
        return this.currentChange && this.currentChange.headEventIds.length === 0;
      },
    },
    watch: {
      selectedChangeIndex() {
        this.$nextTick(this.applySelection);
      },
    },
    methods: {
      loadComparison(comparison) {
        if (!comparison || comparison.kind !== 'appmap.sequence-comparison')
          throw new Error('Invalid AppMap sequence comparison bundle');
        this.comparison = comparison;
        this.comparisonKey += 1;
        this.selectedChangeIndex = 0;
        this.$nextTick(() => this.$nextTick(this.applySelection));
      },
      previousChange() {
        if (!this.changes.length) return;
        this.selectedChangeIndex =
          (this.selectedChangeIndex - 1 + this.changes.length) % this.changes.length;
      },
      nextChange() {
        if (!this.changes.length) return;
        this.selectedChangeIndex = (this.selectedChangeIndex + 1) % this.changes.length;
      },
      removeHighlights() {
        this.$el
          .querySelectorAll('.appmap-comparison-selected')
          .forEach((element) => element.classList.remove('appmap-comparison-selected'));
      },
      focusEvents(componentRef, eventIds) {
        const component = this.$refs[componentRef];
        if (!component || !component.$el || !eventIds?.length) return;
        let first;
        eventIds.forEach((eventId) => {
          const element = component.$el.querySelector(`[data-event-ids~="${eventId}"]`);
          if (!element) return;
          element.classList.add('appmap-comparison-selected');
          if (!first) first = element;
        });
        first?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      },
      applySelection() {
        this.removeHighlights();
        if (!this.currentChange) return;
        this.focusEvents('baseDiagram', this.currentChange.baseEventIds);
        this.focusEvents('headDiagram', this.currentChange.headEventIds);
        this.focusEvents('diffDiagram', this.currentChange.diffEventIds);
      },
      synchronizeScroll(sourceRef, targetRef) {
        if (!this.lockScroll || this.synchronizingScroll) return;
        const source = this.$refs[sourceRef];
        const target = this.$refs[targetRef];
        if (!source || !target) return;

        this.synchronizingScroll = true;
        const sourceVerticalRange = Math.max(1, source.scrollHeight - source.clientHeight);
        const targetVerticalRange = Math.max(0, target.scrollHeight - target.clientHeight);
        const sourceHorizontalRange = Math.max(1, source.scrollWidth - source.clientWidth);
        const targetHorizontalRange = Math.max(0, target.scrollWidth - target.clientWidth);
        target.scrollTop = (source.scrollTop / sourceVerticalRange) * targetVerticalRange;
        target.scrollLeft = (source.scrollLeft / sourceHorizontalRange) * targetHorizontalRange;
        requestAnimationFrame(() => {
          this.synchronizingScroll = false;
        });
      },
    },
    mounted() {
      vscode.postMessage({ command: 'comparison-ready' });
    },
    template: `
      <main class="appmap-comparison">
        <template v-if="comparison">
          <section class="appmap-comparison__toolbar">
            <div class="appmap-comparison__title">
              <strong>{{ scenario }}</strong>
              <span>{{ baseRevision }} before PR · {{ headRevision }} after PR</span>
            </div>
            <div class="appmap-comparison__controls">
              <button :disabled="!changes.length" @click="previousChange" aria-label="Previous behavioral change">◀</button>
              <span class="appmap-comparison__counter">{{ counter }}</span>
              <button :disabled="!changes.length" @click="nextChange" aria-label="Next behavioral change">▶</button>
              <label><input type="checkbox" v-model="lockScroll" /> Lock scroll</label>
            </div>
            <div class="appmap-comparison__legend" aria-label="Comparison legend">
              <span class="appmap-comparison__legend--added"><i></i>Added</span>
              <span class="appmap-comparison__legend--removed"><i></i>Removed</span>
              <span class="appmap-comparison__legend--changed"><i></i>Changed</span>
            </div>
          </section>

          <section class="appmap-comparison__top">
            <article class="appmap-comparison__pane">
              <header><strong>Before PR</strong><code>{{ baseRevision }}</code></header>
              <div
                class="appmap-comparison__scroller"
                ref="baseScroller"
                @scroll="synchronizeScroll('baseScroller', 'headScroller')"
              >
                <v-sequence-diagram
                  ref="baseDiagram"
                  :key="'base-' + comparisonKey"
                  :serialized-diagram="comparison.base"
                  :interactive="false"
                />
              </div>
              <span v-if="baseGhost" class="appmap-comparison__ghost">Not present before the PR</span>
            </article>

            <article class="appmap-comparison__pane">
              <header><strong>After PR</strong><code>{{ headRevision }}</code></header>
              <div
                class="appmap-comparison__scroller"
                ref="headScroller"
                @scroll="synchronizeScroll('headScroller', 'baseScroller')"
              >
                <v-sequence-diagram
                  ref="headDiagram"
                  :key="'head-' + comparisonKey"
                  :serialized-diagram="comparison.head"
                  :interactive="false"
                />
              </div>
              <span v-if="headGhost" class="appmap-comparison__ghost">Removed by the PR</span>
            </article>
          </section>

          <section class="appmap-comparison__bottom">
            <header>
              <strong>Unified behavioral diff</strong>
              <span class="appmap-comparison__change" :data-kind="currentKind">
                {{ changeDescription }}
              </span>
            </header>
            <div class="appmap-comparison__scroller">
              <v-sequence-diagram
                ref="diffDiagram"
                :key="'diff-' + comparisonKey"
                :serialized-diagram="comparison.diff"
                :interactive="false"
              />
            </div>
          </section>
        </template>
        <section v-else class="appmap-comparison__empty">Loading AppMap comparison…</section>
      </main>
    `,
  });

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type !== 'update-comparison') return;
    app.loadComparison(message.comparison);
    vscode.setState({ comparison: message.comparison });
    vscode.postMessage({ command: 'onLoadComplete' });
  });

  const state = vscode.getState();
  if (state?.comparison) app.loadComparison(state.comparison);
}
