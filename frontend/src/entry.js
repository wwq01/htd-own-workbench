// 荒天帝工作台 · S2-1 构建化入口
// 严格按 frontend/index.html 原 <script> 顺序 import 各文件，触发其 window.X = X 自附着副作用。
// 顺序至关重要：store 须先于 composables/api/router/components/modules；registry 须先于 router/app；
// theme-manager 须紧邻 app.js 之前（防 FOUC）；app.js 必须最后（真正启动应用）。
// 注意：源文件本身不 import vue/pinia，它们使用 window.Vue / window.Pinia 全局（由 index.html 的 IIFE 包注入）。
// 本文件位于 frontend/src/，故相对路径以 ../js/ 指向 frontend/js/。

// ===== Pinia Store =====
import '../js/store/index.js';
import '../js/store/appStore.js';
import '../js/store/uiStore.js';
import '../js/store/dataStore.js';

// ===== 前端工具函数 =====
import '../js/utils/date.js';
import '../js/utils/copy.js';
import '../js/utils/common.js';
import '../js/utils/icons.js';
import '../js/utils/observable.js';
import '../js/utils/motion.js';
import '../js/utils/fnv1a-hash.js';
import '../js/utils/draft-state.js';
import '../js/utils/draft-saver.js';
import '../js/utils/polling.js';
import '../js/utils/capability-detector.js';
import '../js/utils/anchor.js';

// ===== 模块注册表（S1 单一数据源，须先于 router.js / HtpCommandPalette.js / app.js） =====
import '../js/registry.js';

// ===== 首页卡片声明表（须在 registry.js 之后：解析 module→path 依赖 htdRegistry；须先于 HomePage.js） =====
import '../js/home-cards.js';

// ===== 组合式函数 =====
import '../js/composables/useReducedMotion.js';
import '../js/composables/useSearchParams.js';

// ===== 接口请求封装 =====
import '../js/api.js';

// ===== 路由 =====
import '../js/router.js';

// ===== 通用 UI 组件 =====
import '../js/components/HtpButton.js';
import '../js/components/HtpModal.js';
import '../js/components/HtpCard.js';
import '../js/components/HtpInput.js';
import '../js/components/HtpTextarea.js';
import '../js/components/HtpSelect.js';
import '../js/components/HtpTag.js';
import '../js/components/HtpCheckbox.js';
import '../js/components/HtpEmpty.js';
import '../js/components/StatusDot.js';
import '../js/components/HtpCommandPalette.js';
import '../js/components/ConfirmPermanentDelete.js';

// ===== 业务页面模块 =====
import '../js/modules/HomePage.js';
import '../js/modules/TodoPage.js';
import '../js/modules/ProjectPage.js';
import '../js/modules/DevelopPage.js';
import '../js/modules/EntertainmentPage.js';
import '../js/modules/StudyPage.js';
import '../js/modules/ReviewPage.js';
import '../js/modules/SecretPage.js';
import '../js/modules/DataPage.js';
import '../js/modules/SettingsPage.js';
import '../js/modules/MeetingPage.js';
import '../js/modules/HabitPage.js';
import '../js/modules/TimeBlockPage.js';
import '../js/modules/FinancePage.js';
import '../js/modules/VaultPage.js';
import '../js/modules/RecycleBinPage.js';
import '../js/modules/PocPage.js';
import '../js/modules/BidPage.js';
import '../js/modules/VulnPage.js';
import '../js/modules/IncidentPage.js';
import '../js/modules/ReadingPage.js';
import '../js/modules/AgentPage.js';

// ===== 主题管理器（V1.4，置于 app.js 前，防 FOUC，设置 <html> 三属性） =====
import '../js/utils/theme-manager.js';

// ===== 应用入口（必须最后） =====
import '../js/app.js';
