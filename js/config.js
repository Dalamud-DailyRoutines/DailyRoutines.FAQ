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

// 在浏览器中直接设置为全局变量
if (typeof window !== 'undefined') {
    window.LANGUAGE_CONFIG = LANGUAGE_CONFIG;
}

// 在 Node.js 环境中导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LANGUAGE_CONFIG };
} 