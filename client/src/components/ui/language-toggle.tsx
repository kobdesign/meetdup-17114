import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div 
      className="flex items-center rounded-full border border-white/20 bg-white/10 p-0.5"
      data-testid="language-toggle"
    >
      <button
        onClick={() => changeLanguage('th')}
        className={`px-3 py-1 text-sm font-medium rounded-full transition-all ${
          i18n.language === 'th' 
            ? 'bg-gold text-navy' 
            : 'text-white/70 hover:text-white'
        }`}
        data-testid="button-lang-th"
      >
        TH
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-3 py-1 text-sm font-medium rounded-full transition-all ${
          i18n.language === 'en' 
            ? 'bg-gold text-navy' 
            : 'text-white/70 hover:text-white'
        }`}
        data-testid="button-lang-en"
      >
        EN
      </button>
    </div>
  );
}
