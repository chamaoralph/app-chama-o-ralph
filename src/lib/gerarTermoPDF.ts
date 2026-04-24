import jsPDF from "jspdf";
import { TERMO_SECOES, TERMO_ACEITE_TEXTO, formatarMoeda } from "./termoTexto";

export interface TermoPDFData {
  id: string;
  cliente_nome: string;
  cliente_telefone?: string | null;
  cliente_endereco?: string | null;
  cpf_aceite?: string | null;
  nome_aceite?: string | null;
  tv_marca_modelo?: string | null;
  tv_polegadas?: string | null;
  tv_tipo?: string | null;
  tvs_itens?: Array<{ marca_modelo?: string | null; polegadas?: string | null; tipo?: string | null }> | null;
  modalidade_escolhida?: string | null;
  valor_completa?: number | null;
  valor_colaborativa?: number | null;
  assinatura_base64?: string | null;
  aceito_em?: string | null;
  aceite_user_agent?: string | null;
}

const COBERTURA_COMPLETA = [
  "Técnico + ajudante fazem toda a instalação.",
  "Em caso de dano à TV durante a instalação, a empresa cobre conserto em assistência técnica autorizada.",
  "Se conserto for inviável, a empresa substitui por TV equivalente (mesma marca, tamanho, tecnologia e tempo de uso).",
  "Vale para qualquer TV, sem restrição de tamanho ou tecnologia.",
];

const COBERTURA_COLABORATIVA = [
  "Cliente auxilia o técnico no encaixe da TV (~30 segundos).",
  "Em caso de dano acidental durante esse manuseio, empresa cobre 50% do conserto em assistência indicada.",
  "Limite máximo da contribuição da empresa: R$ 1.000,00.",
  "Apenas TVs até 55\", exceto OLED e Samsung The Frame.",
];

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export async function gerarTermoPDF(termo: TermoPDFData, empresaNome: string): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 18;
  const maxW = pageW - margin * 2;
  let y = margin;

  const checkPage = (need: number) => {
    if (y + need > pageH - 20) {
      doc.addPage();
      y = margin;
    }
  };

  const writeText = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number } = {}) => {
    const { size = 10, bold = false, color = [30, 30, 30], gap = 1.5 } = opts;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      checkPage(size * 0.5);
      doc.text(line, margin, y);
      y += size * 0.45 + gap;
    }
  };

  const writeSectionTitle = (title: string) => {
    y += 2;
    checkPage(10);
    doc.setFillColor(15, 110, 86);
    doc.rect(margin, y - 4, maxW, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin + 2, y + 1);
    y += 6;
    doc.setTextColor(30, 30, 30);
  };

  // ====== HEADER ======
  doc.setFillColor(15, 110, 86);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(empresaNome || "Empresa", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Termo de Instalação de TV — Aceite Digital", margin, 16);
  doc.setFontSize(8);
  doc.text(`ID: ${termo.id.slice(0, 8)} · Emitido: ${fmt(termo.aceito_em)}`, margin, 20);
  y = 30;
  doc.setTextColor(30, 30, 30);

  // ====== SEÇÃO 1 — Cliente ======
  writeSectionTitle("1. DADOS DO CLIENTE");
  writeText(`Nome: ${termo.nome_aceite || termo.cliente_nome || "—"}`);
  writeText(`CPF: ${termo.cpf_aceite || "—"}`);
  writeText(`Telefone: ${termo.cliente_telefone || "—"}`);
  writeText(`Endereço: ${termo.cliente_endereco || "—"}`);

  // ====== SEÇÃO 2 — Equipamento(s) ======
  const tvs = Array.isArray(termo.tvs_itens) && termo.tvs_itens.length > 0
    ? termo.tvs_itens
    : [{ marca_modelo: termo.tv_marca_modelo, polegadas: termo.tv_polegadas, tipo: termo.tv_tipo }];
  writeSectionTitle(tvs.length > 1 ? `2. EQUIPAMENTOS (${tvs.length})` : "2. EQUIPAMENTO");
  tvs.forEach((t, i) => {
    if (tvs.length > 1) writeText(`TV ${i + 1}`, { bold: true, size: 10.5 });
    writeText(`Marca/Modelo: ${t.marca_modelo || "—"}`);
    writeText(`Polegadas: ${t.polegadas || "—"}`);
    writeText(`Tipo: ${t.tipo || "—"}`);
  });

  // ====== SEÇÃO 3 — Modalidade ======
  writeSectionTitle("3. MODALIDADE CONTRATADA");
  const isCompleta = termo.modalidade_escolhida === "completa";
  const nomeModal = isCompleta ? "COMPLETA" : "COLABORATIVA";
  const valorModal = isCompleta ? termo.valor_completa : termo.valor_colaborativa;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(isCompleta ? 30 : 15, isCompleta ? 90 : 110, isCompleta ? 158 : 86);
  checkPage(8);
  doc.text(`${nomeModal}  —  ${formatarMoeda(valorModal)}`, margin, y);
  y += 6;
  doc.setTextColor(30, 30, 30);

  writeText("Coberturas desta modalidade:", { bold: true, size: 10 });
  const coberturas = isCompleta ? COBERTURA_COMPLETA : COBERTURA_COLABORATIVA;
  for (const item of coberturas) writeText(`• ${item}`, { size: 10 });

  // ====== SEÇÃO 4 — Termo Completo ======
  writeSectionTitle("4. TERMO COMPLETO");
  for (const sec of TERMO_SECOES) {
    y += 1;
    writeText(sec.titulo, { bold: true, size: 10.5 });
    for (const p of sec.paragrafos) {
      writeText(p, { size: 9.5, color: [60, 60, 60] });
    }
  }

  // ====== SEÇÃO 5 — Aceite ======
  writeSectionTitle("5. ACEITE E ASSINATURA");
  writeText(TERMO_ACEITE_TEXTO, { size: 9.5, color: [60, 60, 60] });
  y += 2;

  // Assinatura
  if (termo.assinatura_base64) {
    checkPage(45);
    writeText("Assinatura digital:", { bold: true, size: 10 });
    try {
      doc.addImage(termo.assinatura_base64, "PNG", margin, y, 70, 30);
      y += 32;
    } catch {
      writeText("[assinatura não pôde ser embutida]", { size: 9, color: [120, 120, 120] });
    }
  }

  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, margin + 80, y);
  y += 4;
  writeText(`${termo.nome_aceite || "—"}  —  CPF ${termo.cpf_aceite || "—"}`, { bold: true, size: 10 });
  writeText(`Data/hora do aceite: ${fmt(termo.aceito_em)}`, { size: 9, color: [80, 80, 80] });
  writeText(`Validade conforme MP 2.200-2/2001 — assinatura eletrônica.`, { size: 8, color: [120, 120, 120] });
  if (termo.aceite_user_agent) {
    writeText(`Dispositivo: ${termo.aceite_user_agent.slice(0, 120)}`, { size: 7, color: [140, 140, 140] });
  }

  // ====== Footer em todas as páginas ======
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`${empresaNome} · Termo ${termo.id.slice(0, 8)}`, margin, pageH - 8);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 8, { align: "right" });
  }

  return doc.output("blob");
}

function slug(s: string): string {
  return (s || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 40);
}

export function nomeArquivoTermo(termo: TermoPDFData): string {
  return `termo-${slug(termo.cliente_nome)}-${termo.id.slice(0, 8)}.pdf`;
}

/**
 * Gera o PDF, faz upload para o bucket `termos-assinados` e atualiza `pdf_url`.
 * Retorna a URL pública. Idempotente: sempre regenera e sobrescreve.
 */
export async function gerarESalvarTermoPDF(
  supabase: any,
  termo: TermoPDFData,
  empresaId: string,
  empresaNome: string,
): Promise<string> {
  const blob = await gerarTermoPDF(termo, empresaNome);
  const path = `${empresaId}/${termo.id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("termos-assinados")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from("termos-assinados").getPublicUrl(path);
  const url = data.publicUrl;
  await supabase.from("termos_aceite").update({ pdf_url: url }).eq("id", termo.id);
  return url;
}
