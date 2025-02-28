const TRANSLATIONS = {
    zh: {
        siteTitle: 'Daily Routines 信息中心',
        search: {
            placeholder: '搜索文档...',
            noResults: '没有找到相关结果',
            searching: '正在搜索...'
        },
        navigation: {
            backToHome: '返回主页',
            tableOfContents: '文档目录'
        },
        loading: {
            article: '正在加载文档...',
            index: '正在加载索引...'
        },
        errors: {
            loadFailed: '加载失败',
            indexLoadError: '无法加载文档索引',
            errorMessage: '错误信息'
        }
    },
    en: {
        siteTitle: 'Daily Routines Info Center',
        search: {
            placeholder: 'Search documents...',
            noResults: 'No results found',
            searching: 'Searching...'
        },
        navigation: {
            backToHome: 'Back to Home',
            tableOfContents: 'Table of Contents'
        },
        loading: {
            article: 'Loading document...',
            index: 'Loading index...'
        },
        errors: {
            loadFailed: 'Load Failed',
            indexLoadError: 'Failed to load document index',
            errorMessage: 'Error message'
        }
    },
    ja: {
        siteTitle: 'Daily Routines インフォメーションセンター',
        search: {
            placeholder: 'ドキュメントを検索...',
            noResults: '結果が見つかりません',
            searching: '検索中...'
        },
        navigation: {
            backToHome: 'ホームに戻る',
            tableOfContents: '目次'
        },
        loading: {
            article: 'ドキュメントを読み込んでいます...',
            index: 'インデックスを読み込んでいます...'
        },
        errors: {
            loadFailed: '読み込みに失敗しました',
            indexLoadError: 'ドキュメントインデックスを読み込めません',
            errorMessage: 'エラーメッセージ'
        }
    }
};

// 在浏览器中设置为全局变量
if (typeof window !== 'undefined') {
    window.TRANSLATIONS = TRANSLATIONS;
}

// 在 Node.js 环境中导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TRANSLATIONS };
} 