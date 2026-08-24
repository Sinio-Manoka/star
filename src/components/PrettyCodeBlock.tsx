import { useEffect, useState } from "react";
import { codeToHtml, type BundledLanguage } from "shiki";

type PrettyCodeBlockProps = {
  code: string;
  language?: BundledLanguage;
};

export function PrettyCodeBlock({ code, language = "typescript" }: PrettyCodeBlockProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let active = true;
    void codeToHtml(code, { lang: language, theme: "github-dark-default" }).then(
      (result) => active && setHtml(result),
    );
    return () => {
      active = false;
    };
  }, [code, language]);

  return <div className="pretty-code" dangerouslySetInnerHTML={{ __html: html }} />;
}
