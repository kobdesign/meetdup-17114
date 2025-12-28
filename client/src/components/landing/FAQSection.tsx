import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQSection = () => {
  const { t } = useTranslation();

  const faqs = [
    { key: "security", testId: "accordion-security" },
    { key: "line", testId: "accordion-line" },
    { key: "migration", testId: "accordion-migration" },
    { key: "roi", testId: "accordion-roi" },
    { key: "training", testId: "accordion-training" },
    { key: "cancel", testId: "accordion-cancel" },
  ];

  return (
    <section id="faq" className="py-24 bg-muted/30">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t("faq.title")}</h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={faq.key} value={`item-${index + 1}`}>
              <AccordionTrigger data-testid={faq.testId}>
                {t(`faq.questions.${faq.key}.q`)}
              </AccordionTrigger>
              <AccordionContent>
                {t(`faq.questions.${faq.key}.a`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;
