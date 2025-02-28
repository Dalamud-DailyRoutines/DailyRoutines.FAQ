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

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LANGUAGE_CONFIG };
} else {
    window.LANGUAGE_CONFIG = LANGUAGE_CONFIG;
} 