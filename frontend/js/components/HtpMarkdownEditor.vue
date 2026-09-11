<script setup>
/**
 * HtpMarkdownEditor - Markdown 编辑器（编辑 / 预览 / 分屏）
 * v-model 绑定文本；工具栏支持加粗/斜体/标题/列表/链接/代码环绕；
 * 预览由 markdown-it 渲染（html:false 关闭原始 HTML 注入，linkify 开启）。
 * 注：预览区 v-html 用于渲染自身生成的 HTML，非 P0-3 图表字符串拼接问题。
 */
import { ref, computed, watch, nextTick } from 'vue';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '输入 Markdown...' },
});
const emit = defineEmits(['update:modelValue']);

const mode = ref('split'); // edit | preview | split
const text = ref(props.modelValue);
const textareaRef = ref(null);

watch(
  () => props.modelValue,
  (v) => {
    if (v !== text.value) text.value = v;
  }
);

const html = computed(() => md.render(text.value || ''));

function onInput(e) {
  text.value = e.target.value;
  emit('update:modelValue', text.value);
}

function setText(next, selStart, selEnd) {
  text.value = next;
  emit('update:modelValue', next);
  nextTick(() => {
    const el = textareaRef.value;
    if (el) {
      el.focus();
      el.setSelectionRange(selStart, selEnd ?? selStart);
    }
  });
}

function wrap(before, after) {
  const el = textareaRef.value;
  const val = text.value;
  const start = el ? el.selectionStart : val.length;
  const end = el ? el.selectionEnd : val.length;
  const selected = val.slice(start, end) || '文本';
  const next = val.slice(0, start) + before + selected + after + val.slice(end);
  setText(next, start + before.length, start + before.length + selected.length);
}

function prefix(prefixStr) {
  const el = textareaRef.value;
  const val = text.value;
  const start = el ? el.selectionStart : val.length;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const next = val.slice(0, lineStart) + prefixStr + val.slice(lineStart);
  setText(next, start + prefixStr.length);
}
</script>

<template>
  <div class="htp-md">
    <div class="htp-md__toolbar">
      <button type="button" class="htp-md__btn" title="加粗" @click="wrap('**', '**')"><b>B</b></button>
      <button type="button" class="htp-md__btn" title="斜体" @click="wrap('*', '*')"><i>I</i></button>
      <button type="button" class="htp-md__btn" title="标题" @click="prefix('## ')">H</button>
      <button type="button" class="htp-md__btn" title="列表" @click="prefix('- ')">•</button>
      <button type="button" class="htp-md__btn" title="链接" @click="wrap('[', '](url)')">链接</button>
      <button type="button" class="htp-md__btn" title="代码" @click="wrap('`', '`')">&lt;/&gt;</button>
      <span class="htp-md__spacer"></span>
      <button
        type="button"
        class="htp-md__mode"
        :class="{ 'htp-md__mode--active': mode === 'edit' }"
        @click="mode = 'edit'"
      >
        编辑
      </button>
      <button
        type="button"
        class="htp-md__mode"
        :class="{ 'htp-md__mode--active': mode === 'preview' }"
        @click="mode = 'preview'"
      >
        预览
      </button>
      <button
        type="button"
        class="htp-md__mode"
        :class="{ 'htp-md__mode--active': mode === 'split' }"
        @click="mode = 'split'"
      >
        分屏
      </button>
    </div>
    <div class="htp-md__body" :class="`htp-md__body--${mode}`">
      <textarea
        v-show="mode !== 'preview'"
        ref="textareaRef"
        class="htp-md__input"
        :placeholder="placeholder"
        :value="text"
        @input="onInput"
      ></textarea>
      <div
        v-show="mode !== 'edit'"
        class="htp-md__preview"
        :class="{ 'htp-md__preview--alone': mode === 'preview' }"
        v-html="html"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.htp-md {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-base);
  background: var(--bg-card);
  overflow: hidden;
}
.htp-md__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-default);
  background: var(--bg-tertiary);
}
.htp-md__btn,
.htp-md__mode {
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.htp-md__btn:hover,
.htp-md__mode:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.htp-md__mode--active {
  background: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}
.htp-md__spacer {
  flex: 1;
}
.htp-md__body {
  display: flex;
  min-height: 160px;
}
.htp-md__body--edit .htp-md__input,
.htp-md__body--split .htp-md__input {
  flex: 1;
}
.htp-md__body--split .htp-md__preview {
  flex: 1;
  border-left: 1px solid var(--border-default);
}
.htp-md__body--preview .htp-md__preview {
  flex: 1;
}
.htp-md__input {
  border: none;
  outline: none;
  resize: vertical;
  padding: 12px;
  min-height: 160px;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  line-height: 1.6;
}
.htp-md__preview {
  padding: 12px 14px;
  overflow-y: auto;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.htp-md__preview :deep(h1),
.htp-md__preview :deep(h2),
.htp-md__preview :deep(h3) {
  color: var(--text-primary);
  margin: 0.6em 0 0.4em;
}
.htp-md__preview :deep(a) {
  color: var(--color-primary);
}
.htp-md__preview :deep(code) {
  background: var(--bg-tertiary);
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono, monospace);
}
.htp-md__preview :deep(pre) {
  background: var(--bg-tertiary);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.htp-md__preview :deep(blockquote) {
  border-left: 3px solid var(--border-hover);
  margin: 0.5em 0;
  padding-left: 12px;
  color: var(--text-tertiary);
}
</style>
