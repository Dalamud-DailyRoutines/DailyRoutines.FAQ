// 语言配置
const LANGUAGE_CONFIG = {
    default: 'zh',
    supported: ['zh', 'en', 'ja'],
    labels: {
        'zh': '中文',
        'en': 'English',
        'ja': '日本語'
    }
};

// 分类权重配置，权重越大越靠前，未定义的分类默认为0
const CATEGORY_WEIGHTS = {
    '常见问题-FAQ': 100,
    '更新日志-UpdateNote': 90,
    '其他-Other': -1
};

// 在浏览器中直接设置为全局变量
if (typeof window !== 'undefined') {
    window.LANGUAGE_CONFIG = LANGUAGE_CONFIG;
}

// 在 Node.js 环境中导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LANGUAGE_CONFIG, CATEGORY_WEIGHTS };
}

// 确保在浏览器环境中全局可用
if (typeof window !== 'undefined' && !window.LANGUAGE_CONFIG) {
    Object.defineProperty(window, 'LANGUAGE_CONFIG', {
        value: LANGUAGE_CONFIG,
        writable: false,
        configurable: false
    });
}