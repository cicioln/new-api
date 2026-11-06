/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import {
  BookOpen,
  ChevronRight,
  Download,
  Info,
  KeyRound,
  ListChecks,
  Search,
  TriangleAlert,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  CodeBlock,
  CodeBlockCopyButton,
} from "@/components/ai-elements/code-block";
import { PublicLayout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useStatus } from "@/hooks/use-status";
import { formatBillingCurrencyFromUSD } from "@/lib/currency";
import { getLobeIcon } from "@/lib/lobe-icon";
import { cn } from "@/lib/utils";
import {
  buildSample,
  FALLBACK_ENDPOINT_PATHS,
} from "@/features/pricing/components/model-details-api";
import { QUOTA_TYPE_VALUES } from "@/features/pricing/constants";
import { usePricingData } from "@/features/pricing/hooks";
import { buildSupportedParameters } from "@/features/pricing/lib/mock-stats";
import type { PricingModel } from "@/features/pricing/types";

import {
  curatedModelDoc,
  GUIDES,
  pick,
  type CodeLang,
  type Guide,
  type GuideBlock,
  type Localized,
  type ModelDoc,
} from "./content";

const GUIDE_ICONS: Record<string, LucideIcon> = {
  welcome: BookOpen,
  endpoints: Waypoints,
  tasks: ListChecks,
  faq: KeyRound,
};

const ENDPOINT_KIND: Record<string, Localized> = {
  openai: { en: "Text", zh: "Text" },
  "image-generation": { en: "Image", zh: "Image" },
  "openai-video": { en: "Video", zh: "Video" },
  embeddings: { en: "Embedding", zh: "Embedding" },
  anthropic: { en: "Text", zh: "Text" },
  gemini: { en: "Text", zh: "Text" },
};

function useZh() {
  const { i18n } = useTranslation();
  return (i18n.resolvedLanguage || i18n.language || "")
    .toLowerCase()
    .startsWith("zh");
}

function useBaseUrl() {
  const { status } = useStatus();
  return useMemo(() => {
    const record = status as Record<string, unknown> | null;
    const candidate =
      record?.server_address ??
      (record?.data as Record<string, unknown> | undefined)?.server_address;
    if (typeof candidate === "string" && candidate)
      return candidate.replace(/\/$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "https://api.example.com";
  }, [status]);
}

function modelKind(model: PricingModel, zh: boolean): string {
  const type = model.supported_endpoint_types?.[0] ?? "";
  const kind = ENDPOINT_KIND[type];
  return kind ? pick(kind, zh) : type || "API";
}

// ---------------------------------------------------------------------------
// Layout: header, sidebar with guides and the model catalog
// ---------------------------------------------------------------------------

function DocsShell(props: {
  children: ReactNode;
  activeGuide?: string;
  activeModel?: string;
}) {
  const { t } = useTranslation();
  const zh = useZh();
  const { models, isLoading } = usePricingData();
  const [query, setQuery] = useState("");

  const vendors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const groups = new Map<string, { icon?: string; models: PricingModel[] }>();
    for (const model of models) {
      if (needle && !model.model_name.toLowerCase().includes(needle)) continue;
      const name = model.vendor_name || t("Other");
      const group = groups.get(name) ?? { icon: model.vendor_icon, models: [] };
      group.models.push(model);
      groups.set(name, group);
    }
    return [...groups.entries()]
      .map(([name, group]) => ({
        name,
        icon: group.icon,
        models: group.models.sort((a, b) =>
          a.model_name.localeCompare(b.model_name),
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models, query, t]);

  return (
    <PublicLayout showMainContainer={false}>
      <div className="mx-auto flex w-full max-w-[1440px] flex-col md:flex-row">
        <aside className="border-b md:sticky md:top-[60px] md:h-[calc(100svh-60px)] md:w-[272px] md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
          <div className="grid gap-5 p-4">
            <div className="bg-primary/5 border-primary/20 text-muted-foreground rounded-lg border p-3 text-xs leading-relaxed">
              {zh
                ? "先读「开始使用」完成接入，再在模型目录里选模型，查看参数和调用示例。"
                : "Read Getting started to connect, then pick a model in the catalog for its parameters and examples."}
            </div>

            <nav className="grid gap-0.5">
              <SidebarHeading>{zh ? "开始使用" : "Start here"}</SidebarHeading>
              {GUIDES.map((guide) => {
                const Icon = GUIDE_ICONS[guide.id] ?? BookOpen;
                return (
                  <Link
                    key={guide.id}
                    to="/docs"
                    search={{ page: guide.id }}
                    className={sidebarItem(props.activeGuide === guide.id)}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{pick(guide.title, zh)}</span>
                  </Link>
                );
              })}
            </nav>

            <nav className="grid gap-0.5">
              <SidebarHeading>
                {zh ? "模型目录 · 按供应商" : "Models by vendor"}
              </SidebarHeading>
              <div className="relative mb-1.5">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("Search models")}
                  aria-label={t("Search models")}
                  className="h-8 pl-8 text-[13px]"
                />
              </div>
              {isLoading &&
                [0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-7 w-full" />
                ))}
              {!isLoading && vendors.length === 0 && (
                <p className="text-muted-foreground px-2.5 py-2 text-xs">
                  {t("No models found")}
                </p>
              )}
              {vendors.map((vendor) => (
                <details
                  key={vendor.name}
                  open={
                    query.trim() !== "" ||
                    vendor.models.some(
                      (model) => model.model_name === props.activeModel,
                    )
                  }
                  className="group/vendor"
                >
                  <summary className="text-foreground hover:bg-muted flex cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium">
                    <ChevronRight className="text-muted-foreground size-3.5 shrink-0 transition-transform group-open/vendor:rotate-90" />
                    {vendor.icon ? getLobeIcon(vendor.icon, 14) : null}
                    <span className="truncate">{vendor.name}</span>
                    <span className="text-muted-foreground ml-auto text-[11px]">
                      {vendor.models.length}
                    </span>
                  </summary>
                  <div className="ml-4 grid gap-0.5 border-l py-1 pl-2">
                    {vendor.models.map((model) => (
                      <Link
                        key={model.model_name}
                        to="/docs/models/$modelId"
                        params={{ modelId: model.model_name }}
                        className={cn(
                          sidebarItem(props.activeModel === model.model_name),
                          "py-1",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                          {model.model_name}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-[10.5px]">
                          {modelKind(model, zh)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </details>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 pt-8 pb-16 md:px-10 md:pt-10">
          <div className="mx-auto max-w-[960px]">{props.children}</div>
        </main>
      </div>
    </PublicLayout>
  );
}

function SidebarHeading(props: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1 px-2.5 text-xs font-semibold tracking-wide">
      {props.children}
    </p>
  );
}

function sidebarItem(active: boolean) {
  return cn(
    "flex min-w-0 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    active
      ? "bg-primary/10 text-primary font-semibold"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

// ---------------------------------------------------------------------------
// Shared content pieces
// ---------------------------------------------------------------------------

function Breadcrumb(props: { items: string[] }) {
  return (
    <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="bg-primary h-px w-5" />
      {props.items.map((item, index) => (
        <span key={item} className="flex items-center gap-1.5">
          {index > 0 && <span className="text-muted-foreground/50">/</span>}
          <span
            className={
              index === props.items.length - 1 ? "text-foreground" : undefined
            }
          >
            {item}
          </span>
        </span>
      ))}
    </div>
  );
}

function Callout(props: { items: string[] }) {
  if (props.items.length === 0) return null;
  return (
    <div className="border-primary/40 bg-primary/5 flex gap-3 rounded-xl border border-l-4 p-4 text-sm leading-relaxed">
      <TriangleAlert className="text-primary mt-0.5 size-4 shrink-0" />
      <div className="grid gap-1">
        {props.items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </div>
  );
}

function Code(props: { code: string; lang: CodeLang; title?: string }) {
  return (
    <div className="grid gap-1.5">
      {props.title && (
        <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {props.title}
        </p>
      )}
      <CodeBlock code={props.code} language={props.lang} enableCollapse={false}>
        <CodeBlockCopyButton />
      </CodeBlock>
    </div>
  );
}

function SimpleTable(props: {
  head: string[];
  rows: ReactNode[][];
  mono?: number[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground text-xs">
          <tr>
            {props.head.map((cell) => (
              <th key={cell} className="px-4 py-2.5 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "px-4 py-2.5",
                    props.mono?.includes(cellIndex) && "font-mono text-[13px]",
                    cellIndex > 0 &&
                      !props.mono?.includes(cellIndex) &&
                      "text-muted-foreground",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guide pages
// ---------------------------------------------------------------------------

function GuideBlockView(props: { block: GuideBlock; base: string }) {
  const zh = useZh();
  const block = props.block;
  switch (block.kind) {
    case "h":
      return <h2 className="mt-4 text-lg font-bold">{pick(block.text, zh)}</h2>;
    case "p":
      return (
        <p className="text-muted-foreground leading-relaxed">
          {pick(block.text, zh)}
        </p>
      );
    case "list":
      return (
        <ol className="text-muted-foreground grid list-decimal gap-1.5 pl-5 leading-relaxed">
          {block.items.map((item) => (
            <li key={item.en}>{pick(item, zh)}</li>
          ))}
        </ol>
      );
    case "callout":
      return <Callout items={[pick(block.text, zh)]} />;
    case "code":
      return <Code code={block.code(props.base)} lang={block.lang} />;
    case "table":
      return (
        <SimpleTable
          head={block.head.map((cell) => pick(cell, zh))}
          rows={block.rows.map((row) =>
            row.map((cell) =>
              typeof cell === "string" ? cell : pick(cell, zh),
            ),
          )}
          mono={
            block.rows.every((row) => typeof row[1] === "string") ? [1] : [0]
          }
        />
      );
  }
}

export function DocsGuidePage() {
  const { t } = useTranslation();
  const zh = useZh();
  const base = useBaseUrl();
  const search = useSearch({ from: "/docs/" });
  const guide: Guide =
    GUIDES.find((item) => item.id === search.page) ?? GUIDES[0];

  return (
    <DocsShell activeGuide={guide.id}>
      <Breadcrumb items={[t("Docs"), pick(guide.title, zh)]} />
      <h1 className="text-3xl font-extrabold tracking-tight">
        {pick(guide.title, zh)}
      </h1>
      <p className="text-muted-foreground mt-3 leading-relaxed">
        {pick(guide.intro, zh)}
      </p>
      <div className="mt-6 grid gap-4">
        {guide.blocks.map((block, index) => (
          <GuideBlockView key={index} block={block} base={base} />
        ))}
      </div>
    </DocsShell>
  );
}

// ---------------------------------------------------------------------------
// Model pages
// ---------------------------------------------------------------------------

type ResolvedParam = {
  name: string;
  type: string;
  required?: boolean;
  values?: string;
  desc: string;
};

type ResolvedDoc = {
  summary: string;
  notes: string;
  facts: { label: string; value: string }[];
  endpoints: { method: string; path: string; desc: string }[];
  params: ResolvedParam[];
  rules: string[];
  callouts: string[];
  examples: { title: string; lang: CodeLang; code: string }[];
};

function resolveCurated(
  doc: ModelDoc,
  zh: boolean,
  base: string,
  model: string,
): ResolvedDoc {
  return {
    summary: pick(doc.summary, zh),
    notes: pick(doc.notes, zh),
    facts: doc.facts.map((fact) => ({
      label: pick(fact.label, zh),
      value: pick(fact.value, zh),
    })),
    endpoints: doc.endpoints.map((endpoint) => ({
      ...endpoint,
      desc: pick(endpoint.desc, zh),
    })),
    params: doc.params.map((param) => ({
      ...param,
      desc: pick(param.desc, zh),
    })),
    rules: doc.rules.map((rule) => pick(rule, zh)),
    callouts: doc.callouts.map((callout) => pick(callout, zh)),
    examples: doc.examples.map((example) => ({
      title: pick(example.title, zh),
      lang: example.lang,
      code: example.code(base, model),
    })),
  };
}

/** Docs built from the pricing data for models without hand-written docs. */
function useGenericDoc(
  model: PricingModel | undefined,
  endpointMap: Record<string, { path?: string; method?: string }>,
  base: string,
): ResolvedDoc | null {
  const { t } = useTranslation();
  const zh = useZh();
  return useMemo(() => {
    if (!model) return null;
    const endpoints = (model.supported_endpoint_types ?? [])
      .map((type) => {
        const info = endpointMap[type] ?? {};
        const path = (info.path || FALLBACK_ENDPOINT_PATHS[type] || "").replace(
          "{model}",
          model.model_name,
        );
        return { type, path, method: info.method || "POST" };
      })
      .filter((endpoint) => endpoint.path);
    const params = buildSupportedParameters(model).map((param) => ({
      name: param.name,
      type: param.type,
      required: param.required,
      values:
        param.range ??
        (param.enumValues?.length ? param.enumValues.join(" / ") : undefined) ??
        (param.defaultValue !== undefined
          ? `= ${String(param.defaultValue)}`
          : undefined),
      desc: t(param.descriptionKey),
    }));
    const examples = endpoints.flatMap((endpoint) =>
      (["curl", "python"] as const).map((lang) => ({
        title: `${endpoint.method} ${endpoint.path} · ${lang === "curl" ? "cURL" : "Python"}`,
        lang: (lang === "curl" ? "bash" : "python") as CodeLang,
        code: buildSample(lang, endpoint.type, {
          baseUrl: base,
          apiKeyEnv: "NEW_API_KEY",
          modelName: model.model_name,
          endpointType: endpoint.type,
          endpointPath: endpoint.path,
        }),
      })),
    );
    return {
      summary: model.description || model.vendor_description || "",
      notes: "",
      facts: [
        { label: zh ? "类型" : "Type", value: modelKind(model, zh) },
        {
          label: zh ? "接口" : "Endpoints",
          value: endpoints.map((e) => e.path).join(", ") || "—",
        },
      ],
      endpoints: endpoints.map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path,
        desc: endpoint.type,
      })),
      params,
      rules: [],
      callouts: [
        zh
          ? "本页模型名就是请求里要传的 model。"
          : "Send the model name on this page as model.",
      ],
      examples,
    };
  }, [model, endpointMap, base, t, zh]);
}

function priceLabel(model: PricingModel, zh: boolean) {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    const price = formatBillingCurrencyFromUSD(model.model_price ?? 0, {
      digitsLarge: 4,
      digitsSmall: 4,
      abbreviate: false,
    });
    return `${price} / ${zh ? "次" : "request"}`;
  }
  return zh ? "按量计费" : "Usage-based";
}

function toMarkdown(
  model: PricingModel,
  doc: ResolvedDoc,
  zh: boolean,
): string {
  const lines = [`# ${model.model_name}`, ""];
  if (doc.summary) lines.push(doc.summary, "");
  if (doc.notes) lines.push(`> ${doc.notes}`, "");
  lines.push(`## ${zh ? "接口" : "Endpoints"}`, "");
  doc.endpoints.forEach((e) =>
    lines.push(`- \`${e.method} ${e.path}\` ${e.desc}`),
  );
  lines.push("", `## ${zh ? "参数" : "Parameters"}`, "");
  lines.push(
    zh
      ? "| 参数 | 类型 | 必填 | 取值 | 说明 |"
      : "| Name | Type | Required | Values | Description |",
  );
  lines.push("| --- | --- | --- | --- | --- |");
  doc.params.forEach((p) =>
    lines.push(
      `| \`${p.name}\` | ${p.type} | ${p.required ? "✓" : ""} | ${(p.values ?? "").replace(/\|/g, "\\|")} | ${p.desc.replace(/\|/g, "\\|")} |`,
    ),
  );
  if (doc.rules.length || doc.callouts.length) {
    lines.push("", `## ${zh ? "注意事项" : "Notes"}`, "");
    [...doc.callouts, ...doc.rules].forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("", `## ${zh ? "调用示例" : "Examples"}`);
  doc.examples.forEach((example) =>
    lines.push(
      "",
      `### ${example.title}`,
      "",
      "```" + example.lang,
      example.code,
      "```",
    ),
  );
  return lines.join("\n") + "\n";
}

function downloadMarkdown(name: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/markdown;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type ModelView = "overview" | "api" | "examples";

export function DocsModelPage() {
  const { t } = useTranslation();
  const zh = useZh();
  const base = useBaseUrl();
  const navigate = useNavigate();
  const { modelId } = useParams({ from: "/docs/models/$modelId/" });
  const search = useSearch({ from: "/docs/models/$modelId/" });
  const view: ModelView = search.view ?? "overview";
  const { models, endpointMap, isLoading } = usePricingData();
  const model = models.find((item) => item.model_name === modelId);

  const curated = model
    ? curatedModelDoc(model.model_name, model.supported_endpoint_types ?? [])
    : undefined;
  const generic = useGenericDoc(
    curated ? undefined : model,
    endpointMap as Record<string, { path?: string; method?: string }>,
    base,
  );
  const doc =
    curated && model
      ? resolveCurated(curated, zh, base, model.model_name)
      : generic;

  if (isLoading) {
    return (
      <DocsShell activeModel={modelId}>
        <div className="grid gap-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DocsShell>
    );
  }

  if (!model || !doc) {
    return (
      <DocsShell activeModel={modelId}>
        <h1 className="text-2xl font-bold">{t("Model not found")}</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          {modelId}
        </p>
      </DocsShell>
    );
  }

  const icon = model.icon || model.vendor_icon;
  const tabs: { value: ModelView; label: string }[] = [
    { value: "overview", label: zh ? "能力概览" : "Overview" },
    { value: "api", label: zh ? "接口与参数" : "Endpoints and parameters" },
    { value: "examples", label: zh ? "调用示例" : "Examples" },
  ];

  return (
    <DocsShell activeModel={model.model_name}>
      <Breadcrumb
        items={[
          zh ? "模型" : "Models",
          model.vendor_name || t("Other"),
          model.model_name,
        ]}
      />
      <div className="flex items-center gap-3">
        {icon ? getLobeIcon(icon, 32) : null}
        <h1 className="font-mono text-3xl font-extrabold tracking-tight break-all">
          {model.model_name}
        </h1>
      </div>

      {(doc.summary || doc.notes) && (
        <div className="mt-4 grid gap-1 text-sm leading-relaxed">
          <p className="font-semibold">
            {zh ? "选型说明" : "Choosing this model"}
          </p>
          {doc.summary && (
            <p>
              <span className="text-primary">
                {zh ? "适合用途" : "Best for"}
              </span>
              <span className="text-muted-foreground/60 px-1.5">|</span>
              {doc.summary}
            </p>
          )}
          {doc.notes && (
            <p>
              <span className="text-primary">
                {zh ? "使用注意" : "Watch out"}
              </span>
              <span className="text-muted-foreground/60 px-1.5">|</span>
              {doc.notes}
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <DocTag tone="primary">{modelKind(model, zh)}</DocTag>
        {model.vendor_name && <DocTag>{model.vendor_name}</DocTag>}
        <DocTag tone="price">{priceLabel(model, zh)}</DocTag>
        <Link
          to="/pricing/$modelId"
          params={{ modelId: model.model_name }}
          className="text-muted-foreground hover:text-foreground ml-1 text-xs underline-offset-4 hover:underline"
        >
          {zh ? "查看价格" : "View pricing"}
        </Link>
      </div>

      <div className="mt-8 flex items-center gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() =>
              void navigate({
                to: "/docs/models/$modelId",
                params: { modelId: model.model_name },
                search: { view: tab.value },
                replace: true,
              })
            }
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm whitespace-nowrap outline-none",
              view === tab.value
                ? "border-primary text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() =>
            downloadMarkdown(model.model_name, toMarkdown(model, doc, zh))
          }
          className="text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1.5 px-2 py-2 text-sm whitespace-nowrap"
        >
          <Download className="size-4" />
          {zh ? "下载 MD" : "Download MD"}
        </button>
      </div>

      <div className="mt-6 grid gap-6">
        {view === "overview" && <OverviewView doc={doc} zh={zh} />}
        {view === "api" && <ApiView doc={doc} zh={zh} />}
        {view === "examples" && (
          <ExamplesView doc={doc} zh={zh} base={base} model={model} />
        )}
      </div>
    </DocsShell>
  );
}

function DocTag(props: { children: ReactNode; tone?: "primary" | "price" }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-xs font-medium",
        props.tone === "primary" &&
          "border-primary/40 bg-primary/10 text-primary",
        props.tone === "price" && "bg-muted text-foreground font-semibold",
        !props.tone && "text-muted-foreground",
      )}
    >
      {props.children}
    </span>
  );
}

function OverviewView(props: { doc: ResolvedDoc; zh: boolean }) {
  const { doc, zh } = props;
  return (
    <>
      <div className="bg-card grid gap-x-8 gap-y-4 rounded-xl border p-5 sm:grid-cols-2">
        {doc.facts.map((fact) => (
          <div key={fact.label} className="grid gap-1">
            <span className="text-muted-foreground text-xs">{fact.label}</span>
            <span className="text-sm font-semibold break-words">
              {fact.value}
            </span>
          </div>
        ))}
      </div>

      {doc.params.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {doc.params.map((param) => (
            <div
              key={param.name}
              className="bg-card grid content-start gap-2 rounded-xl border p-4"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <code className="font-mono text-sm font-semibold">
                  {param.name}
                </code>
                {param.required && (
                  <span className="text-destructive text-[11px]">
                    {zh ? "必填" : "required"}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-[13px] leading-relaxed">
                {param.desc}
              </p>
              {param.values && (
                <p className="text-[12.5px]">
                  <span className="text-primary">
                    {zh ? "取值：" : "Values: "}
                  </span>
                  <span className="font-mono">{param.values}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <Callout items={doc.callouts} />

      {doc.rules.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg font-bold">
            {zh ? "参数组合与素材要求" : "Parameter and input rules"}
          </h2>
          <ul className="text-muted-foreground grid list-disc gap-1.5 pl-5 text-sm leading-relaxed">
            {doc.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ApiView(props: { doc: ResolvedDoc; zh: boolean }) {
  const { doc, zh } = props;
  return (
    <>
      <section className="grid gap-3">
        <SectionHeading icon={Waypoints}>
          {zh ? "接口" : "Endpoints"}
        </SectionHeading>
        <SimpleTable
          head={
            zh ? ["方法", "路径", "说明"] : ["Method", "Path", "Description"]
          }
          rows={doc.endpoints.map((endpoint) => [
            <span className="text-primary font-mono text-xs font-semibold">
              {endpoint.method}
            </span>,
            endpoint.path,
            endpoint.desc,
          ])}
          mono={[1]}
        />
      </section>
      <section className="grid gap-3">
        <SectionHeading icon={KeyRound}>
          {zh ? "身份验证" : "Authentication"}
        </SectionHeading>
        <Code code="Authorization: Bearer <YOUR_API_KEY>" lang="bash" />
      </section>
      {doc.params.length > 0 && (
        <section className="grid gap-3">
          <SectionHeading icon={Info}>
            {zh ? "请求参数" : "Request parameters"}
          </SectionHeading>
          <SimpleTable
            head={
              zh
                ? ["参数", "类型", "必填", "取值", "说明"]
                : ["Name", "Type", "Required", "Values", "Description"]
            }
            rows={doc.params.map((param) => [
              <code className="font-mono text-[13px] font-semibold">
                {param.name}
              </code>,
              param.type,
              param.required ? (zh ? "是" : "Yes") : "",
              param.values ?? "",
              param.desc,
            ])}
            mono={[1, 3]}
          />
        </section>
      )}
      <Callout items={doc.callouts} />
    </>
  );
}

function ExamplesView(props: {
  doc: ResolvedDoc;
  zh: boolean;
  base: string;
  model: PricingModel;
}) {
  const { doc, zh } = props;
  const isVideo = (props.model.supported_endpoint_types ?? []).includes(
    "openai-video",
  );
  return (
    <>
      {isVideo && (
        <section className="grid gap-3">
          <SectionHeading icon={ListChecks}>
            {zh ? "轮询与结果" : "Polling and results"}
          </SectionHeading>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {zh
              ? "提交后返回任务 id。每 5 到 10 秒查询一次，直到 status 为 completed 或 failed，完成后下载 /content。"
              : "Submitting returns a task id. Query every 5 to 10 seconds until status is completed or failed, then download /content."}
          </p>
        </section>
      )}
      {doc.examples.map((example) => (
        <Code
          key={example.title}
          title={example.title}
          code={example.code}
          lang={example.lang}
        />
      ))}
    </>
  );
}

function SectionHeading(props: { icon: LucideIcon; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <h2 className="flex items-center gap-2 text-base font-bold">
      <Icon className="text-muted-foreground size-4" />
      {props.children}
    </h2>
  );
}
