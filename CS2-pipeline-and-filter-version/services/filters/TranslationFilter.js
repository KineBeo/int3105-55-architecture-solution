const Filter = require('./Filter');
const { translate } = require('../../utils/translate');

class TranslationFilter extends Filter {
    async process(text) {
        const translatedText = await translate(text);
        return translatedText;
    }
}

module.exports = TranslationFilter;
