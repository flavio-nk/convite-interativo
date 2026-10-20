"""Bateria de testes de navegador: dados salvos de ponta a ponta.

Uso (local):
    npm run build && rm -rf .data && npm run serve      # em outro terminal (senha local: convite)
    pip install playwright && python -m playwright install chromium
    python tests/e2e.py
Contra outro endereço:  BASE_URL=https://... ADMIN_PASSWORD=... python tests/e2e.py
"""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, 'fixtures') + '/'
BASE = os.environ.get('BASE_URL', 'http://localhost:3000/').rstrip('/') + '/'
PASSWORD = os.environ.get('ADMIN_PASSWORD', 'convite')
results, errors = [], []


def ok(name, cond, info=''):
    results.append((bool(cond), name, info))


def safe(name, fn, *a):
    try:
        return fn(*a) if a and a[0] is not None else fn()
    except Exception as e:  # noqa
        results.append((False, name + ' [exceção]', str(e).split('\n')[0][:220]))


def go(pg, route, wait=900):
    pg.goto('about:blank')
    pg.goto(BASE + '#/' + route)
    pg.wait_for_timeout(wait)


def count(pg, sel):
    return pg.locator(sel).count()


def text(pg):
    return pg.inner_text('body')


def wait_saved(pg, timeout=8000):
    pg.wait_for_function("() => document.body.innerText.includes('todas as alterações salvas')", timeout=timeout)


state = {}


def t_login(pg):
    go(pg, 'Main')
    ok('Login: pede senha', count(pg, '#pw') == 1)
    pg.fill('#pw', 'errada'); pg.click('button:has-text("Entrar")'); pg.wait_for_timeout(900)
    ok('Login: senha errada recusada', 'Senha incorreta' in text(pg))
    pg.fill('#pw', PASSWORD); pg.click('button:has-text("Entrar")'); pg.wait_for_timeout(1000)
    ok('Login: entra no painel', 'Meus convites' in text(pg))


def t_create(pg):
    go(pg, 'Main')
    pg.click('a:has-text("Novo convite")'); pg.wait_for_timeout(1200)
    ok('Novo convite abre galeria de temas', count(pg, 'h1:has-text("Escolha um tema")') == 1)
    pg.click('[aria-label="Tema Neon"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(1800)
    ok('Usar tema cria convite e abre editor', '#/Editor/' in pg.url, pg.url)
    state['id'] = pg.url.split('#/Editor/')[1].split('?')[0]
    ok('Editor: título com o tema', pg.input_value('#inv-title') == 'Novo convite · Neon', pg.input_value('#inv-title'))
    wait_saved(pg)
    ok('Editor: páginas iniciais salvas', 'todas as alterações salvas' in text(pg))


def t_edit_persist(pg):
    iid = state['id']
    go(pg, 'Editor/' + iid, 1500)
    pg.fill('#inv-title', 'Festa de Teste')
    pg.click('.blk >> nth=1'); pg.wait_for_timeout(150)
    pg.fill('#blk-text', 'Joana & Bruno')
    pg.click('.blk >> nth=0'); pg.wait_for_timeout(150)
    pg.set_input_files('#media-file', FIX + 'foto.png')
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando foto.png')", timeout=10000)
    pg.click('button[role=tab]:has-text("Evento")'); pg.wait_for_timeout(150)
    pg.fill('#ev-kicker', 'Casamento')
    pg.fill('#ev-date', '2027-05-20T17:30')
    pg.click('button[role=tab]:has-text("Música")'); pg.wait_for_timeout(150)
    pg.click('[aria-label="Músicas da biblioteca"] [role=radio]:has-text("Caixinha de música")')
    pg.click('button[role=tab]:has-text("Tema")'); pg.wait_for_timeout(150)
    pg.click('[aria-label="Paleta Oceano"]')
    pg.click('button[role=tab]:has-text("Bloco")')
    pg.click('button.pg:has-text("Detalhes")'); pg.wait_for_timeout(150)
    pg.click('[aria-label^="Bloco Mapa"]'); pg.wait_for_timeout(150)
    pg.fill('#map-name', 'Sítio das Flores'); pg.fill('#map-addr', 'Rua das Acácias, 100, Campinas')
    wait_saved(pg)
    ok('Editor: salva automaticamente', True)
    pg.reload(); pg.wait_for_timeout(1800)
    ok('Recarregar: título salvo', pg.input_value('#inv-title') == 'Festa de Teste', pg.input_value('#inv-title'))
    ok('Recarregar: texto do bloco salvo', count(pg, '[data-canvas] [data-bid] >> text=Joana & Bruno') == 1)
    ok('Recarregar: foto enviada continua', count(pg, '[data-canvas] [data-bid] img') >= 1)
    src = pg.get_attribute('[data-canvas] [data-bid] img >> nth=0', 'src') if count(pg, '[data-canvas] [data-bid] img') else ''
    ok('Recarregar: foto vem do armazenamento (não é temporária)', src and not src.startswith('blob:'), src)
    ok('Recarregar: música salva', 'música: Caixinha de música' in text(pg))
    pg.click('button[role=tab]:has-text("Tema")'); pg.wait_for_timeout(150)
    ok('Recarregar: paleta salva', pg.input_value('#tc-bg').lower() == '#0b3c5d', pg.input_value('#tc-bg'))
    pg.click('button[role=tab]:has-text("Evento")'); pg.wait_for_timeout(150)
    ok('Recarregar: data do evento salva', pg.input_value('#ev-date') == '2027-05-20T17:30', pg.input_value('#ev-date'))
    pg.click('button[role=tab]:has-text("Bloco")')
    pg.click('button.pg:has-text("Detalhes")'); pg.wait_for_timeout(150)
    pg.click('[aria-label^="Bloco Mapa"]'); pg.wait_for_timeout(150)
    ok('Recarregar: endereço do mapa salvo', pg.input_value('#map-addr') == 'Rua das Acácias, 100, Campinas')


def t_preview(pg):
    go(pg, 'Editor/' + state['id'], 1500)
    pg.click('header button:has-text("Pré-visualizar")'); pg.wait_for_timeout(600)
    dlg = '[aria-label="Pré-visualização do convite"]'
    ok('Pré-visualizar abre', count(pg, dlg) == 1)
    pg.click(dlg + ' [aria-label="Toque para abrir o convite"]'); pg.wait_for_timeout(3000)
    ok('Pré-visualizar: abre e mostra o conteúdo editado', count(pg, dlg + ' >> text=Joana & Bruno') >= 1)
    ok('Pré-visualizar: música ativa', count(pg, dlg + ' [aria-label="Pausar música"]') == 1)
    pg.click('text=Fechar prévia')


def t_unpublished_guest(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    g = ctx.new_page()
    g.goto(BASE + '#/c/' + state['id']); g.wait_for_timeout(1500)
    ok('Convidado: rascunho não abre', 'Convite indisponível' in g.inner_text('body'))
    ctx.close()


def t_publish(pg):
    go(pg, 'Editor/' + state['id'], 1500)
    pg.click('header button:has-text("Publicar")'); wait_saved(pg)
    ok('Publicar mostra link', '#/c/' + state['id'] in text(pg))


def t_guest(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
    g = ctx.new_page()
    g.on('pageerror', lambda e: errors.append('convidado: ' + str(e)))
    g.goto(BASE + '#/c/' + state['id']); g.wait_for_timeout(1800)
    ok('Convidado: convite fechado', count(g, '[aria-label="Toque para abrir o convite"]') == 1)
    ok('Convidado: abertura mostra o título', 'Joana & Bruno' in g.inner_text('body'))
    ok('Convidado: conteúdo não aparece antes de abrir', count(g, 'h1:has-text("Joana & Bruno")') == 0)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(500)
    ok('Convidado: o convite surge por trás da animação', count(g, 'h1:has-text("Joana & Bruno")') == 1 and count(g, 'text=Rever abertura') == 0)
    g.wait_for_timeout(2700)
    ok('Convidado: sem tela intermediária', count(g, 'text=Rever abertura') == 0)
    ok('Convidado: abre e mostra a capa', count(g, 'h1:has-text("Joana & Bruno")') == 1)
    ok('Convidado: foto aparece', count(g, 'main img') >= 1)
    ok('Convidado: música tocando', count(g, '[aria-label="Pausar música"]') == 1)
    cd1 = g.inner_text('[aria-label="Contagem regressiva"]'); g.wait_for_timeout(1200)
    ok('Convidado: contagem anda', cd1 != g.inner_text('[aria-label="Contagem regressiva"]'))
    g.click('main button:has-text("Ver detalhes")'); g.wait_for_timeout(500)
    ok('Convidado: botão leva à página Detalhes', 'Sítio das Flores' in g.inner_text('body'))
    href = g.get_attribute('a:has-text("Google Maps")', 'href')
    ok('Convidado: rota do Google Maps com endereço', href and 'Acácias' in __import__('urllib.parse').parse.unquote(href), href)
    g.click('nav[aria-label="Páginas do convite"] >> text=Presença'); g.wait_for_timeout(500)
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(200)
    ok('Convidado: valida nome', 'Informe seu nome' in g.inner_text('body'))
    g.fill('input[autocomplete=name]', 'Carlos Convidado')
    g.click('button:has-text("Sim, eu vou")')
    g.click('[aria-label="Mais um acompanhante"]')
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(1200)
    ok('Convidado: confirmação enviada', 'Presença confirmada' in g.inner_text('body') and '2 lugares' in g.inner_text('body'))
    with g.expect_download() as d:
        g.click('button:has-text("Adicionar à agenda")')
    ok('Convidado: agenda .ics', d.value.suggested_filename.endswith('.ics'))
    g.reload(); g.wait_for_timeout(1500)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(3200)
    g.click('nav[aria-label="Páginas do convite"] >> text=Presença'); g.wait_for_timeout(500)
    ok('Convidado: ao voltar, resposta lembrada', 'Presença confirmada' in g.inner_text('body'))
    g.click('text=Alterar minha resposta'); g.wait_for_timeout(200)
    ok('Convidado: alterar traz o nome', g.input_value('input[autocomplete=name]') == 'Carlos Convidado')
    g.click('button:has-text("Não poderei ir")'); g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(1200)
    ok('Convidado: altera para não vai', 'Resposta enviada' in g.inner_text('body'))
    # segundo convidado, outro aparelho
    ctx2 = browser.new_context(viewport={'width': 390, 'height': 844})
    g2 = ctx2.new_page()
    g2.goto(BASE + '#/c/' + state['id']); g2.wait_for_timeout(1500)
    g2.click('[aria-label="Toque para abrir o convite"]'); g2.wait_for_timeout(3200)
    g2.click('nav[aria-label="Páginas do convite"] >> text=Presença'); g2.wait_for_timeout(500)
    g2.fill('input[autocomplete=name]', 'Dora Silva'); g2.click('button:has-text("Sim, eu vou")')
    g2.click('button:has-text("Enviar resposta")'); g2.wait_for_timeout(1200)
    ok('Segundo convidado responde', 'Presença confirmada' in g2.inner_text('body'))
    sw = g2.evaluate('document.documentElement.scrollWidth')
    ok('Convidado no celular sem rolagem lateral', sw <= 392, sw)
    ctx2.close(); ctx.close()


def t_rsvps(pg):
    go(pg, 'Respostas/' + state['id'], 1500)
    ok('Respostas: 2 linhas', count(pg, 'tbody tr') == 2, count(pg, 'tbody tr'))
    body = text(pg)
    ok('Respostas: resposta alterada aparece como Não vai', 'Carlos Convidado' in body and 'Não vai' in body)
    ok('Respostas: Dora confirmada', 'Dora Silva' in body)
    with pg.expect_download() as d:
        pg.click('button:has-text("Exportar planilha")')
    csv = open(d.value.path(), encoding='utf-8-sig').read()
    ok('Respostas: planilha com dados reais', 'Dora Silva' in csv and 'Carlos Convidado' in csv)


def t_dashboard(pg):
    go(pg, 'Main', 1500)
    ok('Painel: convite salvo na lista', count(pg, 'article:has-text("Festa de Teste")') == 1)
    ok('Painel: contagem de respostas', '1 vão · 1 não vão' in text(pg))
    ok('Painel: data do evento', 'Qui, 20 mai 2027 · 17h30' in text(pg))
    pg.click('[aria-label="Excluir Festa de Teste"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Excluir convite")'); pg.wait_for_timeout(900)
    ok('Painel: excluir remove', count(pg, 'article:has-text("Festa de Teste")') == 0)
    pg.reload(); pg.wait_for_timeout(1500)
    ok('Painel: exclusão persiste', count(pg, 'article:has-text("Festa de Teste")') == 0)


def t_undo(pg):
    # cria e exclui outro para testar o desfazer
    go(pg, 'Temas', 1200)
    pg.click('[aria-label="Tema Jardim"]'); pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(1800)
    wait_saved(pg)
    go(pg, 'Main', 1500)
    pg.click('[aria-label^="Excluir Novo convite · Jardim"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Excluir convite")'); pg.wait_for_timeout(900)
    pg.click('text=Desfazer'); pg.wait_for_timeout(1500)
    ok('Desfazer restaura o convite', count(pg, 'article:has-text("Novo convite · Jardim")') == 1)
    pg.reload(); pg.wait_for_timeout(1500)
    ok('Desfazer persiste', count(pg, 'article:has-text("Novo convite · Jardim")') == 1)


def t_change_theme(pg):
    go(pg, 'Main', 1500)
    pg.click('article:has-text("Novo convite · Jardim") >> text=Editar'); pg.wait_for_timeout(1500)
    eid = pg.url.split('#/Editor/')[1]
    pg.click('button[role=tab]:has-text("Tema")'); pg.click('button:has-text("Trocar tema base")'); pg.wait_for_timeout(1300)
    ok('Trocar tema abre galeria em modo troca', 'Trocar o tema do convite' in text(pg))
    pg.click('[aria-label="Tema Tropical"]'); pg.click('button:has-text("Aplicar ao convite")'); pg.wait_for_timeout(1800)
    ok('Trocar tema volta ao mesmo convite', pg.url.endswith('#/Editor/' + eid), pg.url)
    pg.click('button[role=tab]:has-text("Tema")'); pg.wait_for_timeout(150)
    ok('Trocar tema aplica Tropical', pg.input_value('#th-layout') == 'dividido' and 'Tropical' in text(pg))


def t_custom_theme(pg):
    go(pg, 'CriarTema', 1200)
    pg.fill('#t-name', 'Tema Salvo E2E'); pg.click('[aria-label="Paleta Café"]')
    pg.click('button:has-text("Salvar tema")'); pg.wait_for_timeout(900)
    ok('Criar tema: salvo', 'salvo em Meus temas' in text(pg))
    go(pg, 'Temas', 1300)
    pg.click('button[aria-pressed]:has-text("Meus temas")'); pg.wait_for_timeout(300)
    ok('Meus temas lista o tema salvo', count(pg, '[aria-label="Tema Tema Salvo E2E"]') == 1)
    pg.click('[aria-label="Tema Tema Salvo E2E"]'); pg.click('button:has-text("Editar tema")'); pg.wait_for_timeout(1300)
    ok('Editar tema carrega dados', pg.input_value('#t-name') == 'Tema Salvo E2E' and pg.input_value('#c-bg').lower() == '#3b2a20')
    pg.click('button:has-text("Excluir tema")'); pg.click('[role=alert] button:has-text("Excluir")'); pg.wait_for_timeout(1300)
    pg.click('button[aria-pressed]:has-text("Meus temas")'); pg.wait_for_timeout(300)
    ok('Excluir tema', count(pg, '[aria-label="Tema Tema Salvo E2E"]') == 0)


def t_opening(pg, browser):
    go(pg, 'Temas', 1300)
    pg.click('[aria-label="Tema Jardim"]'); pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(1800)
    wait_saved(pg)
    oid = pg.url.split('#/Editor/')[1]
    pg.click('button[role=tab]:has-text("Abertura")'); pg.wait_for_timeout(300)
    ok('Abertura: aba existe e mostra a prévia fechada', count(pg, 'h2:has-text("Tela de abertura")') == 1 and count(pg, 'main [aria-label="Toque para abrir o convite"]') == 1)
    pg.select_option('#op-anim', 'lacre'); pg.wait_for_timeout(300)
    pg.select_option('#op-trigger', 'botao')
    pg.fill('#op-headline', 'Bem-vindos')
    pg.fill('#op-title', 'Nosso Grande Dia')
    pg.fill('#op-subtitle', 'Domingo à tarde')
    pg.fill('#op-initials', 'JB')
    pg.fill('#op-hint', 'Abrir agora')
    pg.wait_for_timeout(300)
    prev = pg.inner_text('main')
    ok('Abertura: prévia mostra os textos', all(t in prev for t in ['Bem-vindos'.upper(), 'Nosso Grande Dia', 'Domingo à tarde', 'JB', 'Abrir agora']), prev[:200])
    wait_saved(pg)
    pg.reload(); pg.wait_for_timeout(1800)
    pg.click('button[role=tab]:has-text("Abertura")'); pg.wait_for_timeout(300)
    ok('Abertura: configurações salvas', pg.input_value('#op-anim') == 'lacre' and pg.input_value('#op-trigger') == 'botao' and pg.input_value('#op-title') == 'Nosso Grande Dia' and pg.input_value('#op-initials') == 'JB' and pg.input_value('#op-hint') == 'Abrir agora')
    pg.click('header button:has-text("Publicar")'); wait_saved(pg)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + oid); g.wait_for_timeout(1600)
    body = g.inner_text('body')
    ok('Convidado: abertura com os textos configurados', all(t in body for t in ['BEM-VINDOS', 'Nosso Grande Dia', 'Domingo à tarde', 'JB']), body[:200])
    g.mouse.click(195, 300); g.wait_for_timeout(2200)
    ok('Convidado (botão): tocar fora do botão não abre', count(g, 'button:has-text("Abrir agora")') == 1)
    g.click('button:has-text("Abrir agora")'); g.wait_for_timeout(2600)
    ok('Convidado (botão): o botão abre o convite', count(g, 'nav[aria-label="Páginas do convite"]') == 1)
    ctx.close()
    # deslizar
    pg.select_option('#op-trigger', 'deslizar'); wait_saved(pg)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + oid); g.wait_for_timeout(1600)
    g.mouse.click(195, 300); g.wait_for_timeout(1800)
    ok('Convidado (deslizar): toque simples não abre', count(g, 'nav[aria-label="Páginas do convite"]') == 0)
    g.mouse.move(195, 600); g.mouse.down(); g.mouse.move(195, 420, steps=6); g.mouse.move(195, 300, steps=6); g.mouse.up()
    g.wait_for_timeout(2600)
    ok('Convidado (deslizar): deslizar para cima abre', count(g, 'nav[aria-label="Páginas do convite"]') == 1)
    ctx.close()


def set_range(pg, sel, v):
    pg.locator(sel).evaluate("(el, v) => { el.value = v; el.dispatchEvent(new Event('input', {bubbles: true})); }", str(v))
    pg.wait_for_timeout(150)


def phone_img_style(pg):
    return pg.locator('[data-canvas] [data-bid] img').first.get_attribute('style') or ''


def t_photos(pg, browser):
    go(pg, 'Temas', 1300)
    pg.click('[aria-label="Tema Jardim"]'); pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(1800)
    wait_saved(pg)
    fid = pg.url.split('#/Editor/')[1]
    pg.click('.blk >> nth=0'); pg.wait_for_timeout(200)
    ok('Foto: sem foto, não há botão de editar', count(pg, 'button:has-text("Editar foto")') == 0)
    pg.set_input_files('#media-file', FIX + 'paisagem.jpg'); pg.wait_for_timeout(1200)
    wait_saved(pg)
    pg.click('button:has-text("Editar foto")'); pg.wait_for_timeout(700)
    ok('Foto: editor abre com a foto', count(pg, '[role=dialog] [data-testid="pe-frame"] img') == 1)
    set_range(pg, '#pe-zoom', 160)
    fr = pg.locator('[data-testid="pe-frame"]').bounding_box()
    before = pg.locator('[data-testid="pe-frame"] img').get_attribute('style')
    pg.mouse.move(fr['x'] + fr['width'] / 2, fr['y'] + fr['height'] / 2); pg.mouse.down()
    pg.mouse.move(fr['x'] + fr['width'] / 2 + 60, fr['y'] + fr['height'] / 2 + 20, steps=5); pg.mouse.up()
    ok('Foto: arrastar reposiciona', pg.locator('[data-testid="pe-frame"] img').get_attribute('style') != before)
    pg.click('[aria-label="Girar 90° para a direita"]')
    set_range(pg, '#pe-rot', 10)
    pg.click('[aria-label="Espelhar na horizontal"]')
    pg.click('button[role=tab]:has-text("Filtros")'); pg.click('button[role=radio]:has-text("P&B")')
    pg.click('button[role=tab]:has-text("Luz e cor")'); set_range(pg, '#pe-bri', 120)
    pg.click('button:has-text("Aplicar")'); pg.wait_for_timeout(300)
    st = phone_img_style(pg)
    ok('Foto: edição aplicada na prévia', 'grayscale(1)' in st and 'rotate(100deg)' in st and 'scale(-1' in st and 'brightness(1.2)' in st, st)
    # cancelar não altera
    pg.click('button:has-text("Editar foto")'); pg.wait_for_timeout(500)
    pg.click('button[role=tab]:has-text("Filtros")'); pg.click('button[role=radio]:has-text("Sépia")')
    pg.click('[role=dialog] button:has-text("Cancelar")'); pg.wait_for_timeout(300)
    ok('Foto: cancelar descarta as mudanças', 'sepia' not in phone_img_style(pg) and 'grayscale(1)' in phone_img_style(pg))
    pg.click('button:has-text("Editar foto")'); pg.wait_for_timeout(500)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('Foto: Esc fecha o editor', count(pg, '[data-testid="pe-frame"]') == 0)
    pg.select_option('#foto-format', '1:1'); pg.wait_for_timeout(200)
    ok('Foto: formato quadrado', 'aspect-ratio: 1' in (pg.locator('[data-canvas] [data-bid] >> nth=0').locator('div').first.get_attribute('style') or ''))
    # fundo da página
    pg.set_input_files('#bg-file', FIX + 'paisagem.jpg'); pg.wait_for_timeout(1200)
    ok('Fundo: aparece na prévia', count(pg, 'main [data-testid="page-bg"] img') == 1)
    set_range(pg, '#bg-dim', 60)
    pg.click('button:has-text("Editar foto de fundo")'); pg.wait_for_timeout(600)
    pg.click('button[role=tab]:has-text("Filtros")'); pg.click('button[role=radio]:has-text("Sépia")')
    pg.click('button:has-text("Aplicar")'); pg.wait_for_timeout(300)
    pg.click('button:has-text("Usar este fundo em todas as páginas")'); pg.wait_for_timeout(300)
    wait_saved(pg)
    pg.reload(); pg.wait_for_timeout(1800)
    ok('Recarregar: edição da foto salva', 'grayscale(1)' in phone_img_style(pg) and 'rotate(100deg)' in phone_img_style(pg))
    bgst = pg.locator('main [data-testid="page-bg"] img').get_attribute('style') or ''
    ok('Recarregar: fundo e véu salvos', 'sepia(0.8)' in bgst and pg.input_value('#bg-dim') == '60', bgst)
    pg.click('aside li >> nth=1'); pg.wait_for_timeout(300)
    ok('Fundo: aplicado às outras páginas', count(pg, 'main [data-testid="page-bg"] img') == 1)
    pg.click('button:has-text("Remover fundo")'); pg.wait_for_timeout(200)
    ok('Fundo: remover', count(pg, 'main [data-testid="page-bg"]') == 0)
    pg.click('header button:has-text("Publicar")'); wait_saved(pg)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + fid); g.wait_for_timeout(1500)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2800)
    gst = g.locator('main img').first.get_attribute('style') or ''
    ok('Convidado: foto com as edições', 'grayscale(1)' in gst and 'rotate(100deg)' in gst, gst)
    ok('Convidado: foto de fundo da página', count(g, '[data-testid="page-bg"] img') == 1)
    g.click('nav button:has-text("Detalhes")'); g.wait_for_timeout(500)
    ok('Convidado: página sem fundo fica sem foto', count(g, '[data-testid="page-bg"]') == 0)
    ctx.close()


def ovl(pg):
    return pg.evaluate("Array.from(document.querySelectorAll('[data-ovl]')).map(e => e.getAttribute('data-ovl'))")


def drag(pg, sel, dx, dy, steps=12, before_up=None):
    b = pg.locator(sel).bounding_box()
    x, y = b['x'] + min(40, b['width'] / 2), b['y'] + min(12, b['height'] / 2)
    pg.mouse.move(x, y); pg.mouse.down()
    pg.mouse.move(x + dx, y + dy, steps=steps)
    r = before_up() if before_up else None
    pg.mouse.up(); pg.wait_for_timeout(400)
    return r


def t_dnd(pg, browser):
    go(pg, 'Temas', 1300)
    pg.click('[aria-label="Tema Jardim"]'); pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(2000)
    wait_saved(pg)
    did = pg.url.split('#/Editor/')[1]
    state['dnd'] = did
    order0 = ovl(pg)
    ok('Arrastar: prévia do editor mostra todos os blocos', order0 == ['c1', 'c2', 'c3', 'c4', 'c5'], order0)
    pg.wait_for_timeout(800)
    pg.locator('[data-ovl="c2"]').click(); pg.wait_for_timeout(200)
    ok('Posição livre é o padrão: blocos já têm posição', pg.input_value('#pos-x') != '' and 'Enquadramento ok' in pg.inner_text('[data-testid="check"]'), pg.inner_text('[data-testid="check"]'))
    ok('Modo automático não existe mais', count(pg, 'button[role=radio]:has-text("Automático")') == 0)
    # tamanho da fonte
    pg.fill('#blk-fs', '60'); pg.press('#blk-fs', 'Tab'); pg.wait_for_timeout(400)
    fsz = pg.evaluate("getComputedStyle(document.querySelector('[data-canvas] [data-bid=\"c2\"] h1')).fontSize")
    ok('Fonte: título com 60 px na prévia', fsz == '60px', fsz)
    pg.locator('[data-ovl="c3"]').click(); pg.wait_for_timeout(200)
    set_range(pg, '#blk-fs-range', 22)
    fsz3 = pg.evaluate("getComputedStyle(document.querySelector('[data-canvas] [data-bid=\"c3\"] p')).fontSize")
    ok('Fonte: texto com 22 px (controle deslizante)', fsz3 == '22px', fsz3)
    pg.locator('[data-ovl="c5"]').click(); pg.wait_for_timeout(200)
    pg.fill('#blk-fs', '20'); pg.press('#blk-fs', 'Tab'); pg.wait_for_timeout(300)
    fsz5 = pg.evaluate("getComputedStyle(document.querySelector('[data-canvas] [data-bid=\"c5\"] button')).fontSize")
    ok('Fonte: botão com 20 px', fsz5 == '20px', fsz5)
    pg.locator('[data-ovl="c1"]').click(); pg.wait_for_timeout(200)
    ok('Fonte: bloco de foto não tem tamanho de fonte', count(pg, '#blk-fs') == 0)
    pg.locator('[data-ovl="c5"]').click(); pg.wait_for_timeout(200)
    y0 = int(pg.input_value('#pos-y'))
    guides = drag(pg, '[data-ovl="c5"]', 0, 60, before_up=lambda: count(pg, '[data-testid="guide"]'))
    y1 = int(pg.input_value('#pos-y'))
    ok('Posição livre: arrastar move o bloco', y1 > y0 + 40, (y0, y1))
    ok('Posição livre: guia de centro aparece ao arrastar', guides >= 1, guides)
    ok('Posição livre: continua centralizado (encaixe)', pg.input_value('#pos-x') == str(round(195 - int(pg.input_value('#pos-w')) / 2)), pg.input_value('#pos-x'))
    pg.locator('[data-ovl="c5"]').focus(); pg.keyboard.press('ArrowRight'); pg.keyboard.press('Shift+ArrowDown'); pg.wait_for_timeout(300)
    ok('Posição livre: setas ajustam 1 px e Shift 10 px', int(pg.input_value('#pos-y')) == y1 + 10)
    # sobreposição
    c4 = pg.locator('[data-ovl="c4"]').bounding_box(); c1 = pg.locator('[data-ovl="c1"]').bounding_box()
    drag(pg, '[data-ovl="c4"]', 0, c1['y'] + 30 - c4['y'])
    chk = pg.inner_text('[data-testid="check"]')
    ok('Verificação: avisa bloco sobreposto', 'sobreposto' in chk, chk)
    pg.click('[data-ovl="c5"]'); pg.wait_for_timeout(150)
    pg.click('[data-testid="check"] button >> nth=0'); pg.wait_for_timeout(200)
    ok('Verificação: tocar no aviso seleciona o bloco', pg.get_attribute('[data-ovl="c5"]', 'aria-pressed') == 'false')
    pg.locator('[data-ovl="c4"]').focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    pg.fill('#pos-y', '560'); pg.press('#pos-y', 'Tab'); pg.wait_for_timeout(300)
    # largura pelas alças e alinhamento
    pg.click('[aria-label="Ocupar a largura entre as margens"]'); pg.wait_for_timeout(200)
    ok('Alinhar: largura entre as margens', pg.input_value('#pos-x') == '20' and pg.input_value('#pos-w') == '350')
    pg.locator('[data-handles="c4"] [data-handle="r"]').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    h = pg.locator('[data-handles="c4"] [data-handle="r"]').bounding_box()
    pg.mouse.move(h['x'] + 5, h['y'] + 10); pg.mouse.down(); pg.mouse.move(h['x'] - 80, h['y'] + 10, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    ok('Alça: estreita o bloco', int(pg.input_value('#pos-w')) < 300, pg.input_value('#pos-w'))
    pg.click('[aria-label="Centralizar na largura da tela"]'); pg.wait_for_timeout(200)
    wv = int(pg.input_value('#pos-w'))
    ok('Alinhar: centralizar', pg.input_value('#pos-x') == str(round(195 - wv / 2)))
    xs = {b: pg.locator('[data-ovl="%s"]' % b).bounding_box() for b in ['c4']}
    wait_saved(pg)
    pg.reload(); pg.wait_for_timeout(2000)
    pg.locator('[data-ovl="c4"]').click(); pg.wait_for_timeout(200)
    ok('Recarregar: posições salvas', pg.input_value('#pos-y') == '560' and int(pg.input_value('#pos-w')) == wv, (pg.input_value('#pos-y'), pg.input_value('#pos-w')))
    # convidado vê as mesmas posições
    pg.click('header button:has-text("Publicar")'); wait_saved(pg)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + did); g.wait_for_timeout(1500)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2800)
    st = g.locator('[data-bid="c4"]').get_attribute('style') or ''
    ok('Convidado: bloco na posição livre', 'top: 560px' in st and 'width: %dpx' % wv in st, st)
    gf = g.evaluate("getComputedStyle(document.querySelector('[data-bid=\"c2\"] h1')).fontSize")
    ok('Convidado: título com o tamanho de fonte escolhido', gf == '60px', gf)
    ctx.close()
    pg.locator('[data-ovl="c2"]').focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    ok('Recarregar: tamanho da fonte salvo', pg.input_value('#blk-fs') == '60', pg.input_value('#blk-fs'))


def t_loading(pg, browser):
    go(pg, 'Editor/' + state['dnd'], 1500)
    link = pg.inner_text('[role=status] span span').strip()
    ok('Link do convidado leva as cores do tema', '?t=' in link and len(link.split('?t=')[1].split('.')) == 3, link)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    held = []
    hold = [True]
    g.route('**/api/invites*', lambda r: held.append(r) if hold[0] else r.continue_())
    g.goto(link)
    g.wait_for_selector('.ci-spin', timeout=5000)
    bg = '#' + link.split('?t=')[1].split('.')[0]
    rgb = 'rgb(%d, %d, %d)' % tuple(int(bg[i:i + 2], 16) for i in (1, 3, 5))
    loading_bg = g.evaluate("getComputedStyle(document.querySelector('.ci-spin').parentElement).backgroundColor")
    ok('Carregamento: tela nas cores do tema', loading_bg == rgb, (loading_bg, rgb))
    hold[0] = False
    for r in held:
        r.continue_()
    g.wait_for_timeout(1500)
    ok('Carregamento: guarda as cores no aparelho', g.evaluate("localStorage.getItem('ci:tema:%s')" % state['dnd']) == link.split('?t=')[1])
    ctx.close()
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.route('**/assets/*.js', lambda r: r.abort())
    g.goto(link.split('?')[0]); g.wait_for_timeout(400)
    ok('Carregamento: link sem cores usa fundo neutro', g.evaluate("getComputedStyle(document.body).backgroundColor") == 'rgb(28, 27, 34)')
    ctx.close()


def t_tap_margin(browser):
    # celular com barras do navegador: sobram faixas ao lado do convite; tocar nelas também abre
    ctx = browser.new_context(viewport={'width': 390, 'height': 664}, has_touch=True, is_mobile=True); g = ctx.new_page()
    g.goto(BASE + '#/c/' + state['dnd']); g.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000); g.wait_for_timeout(300)
    box = g.locator('[data-dc="Abertura"]').first.bounding_box()
    ok('Abertura: há faixa ao lado do convite neste aparelho', box['x'] > 10, box)
    g.touchscreen.tap(4, 330); g.wait_for_timeout(500)
    ok('Abertura (toque): tocar na faixa ao lado abre o convite', count(g, 'main') == 1)
    ctx.close()


def t_open_anim(browser):
    # a animação de abertura precisa passar por posições intermediárias (não pular para o fim)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + state['dnd']); g.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000); g.wait_for_timeout(500)
    g.mouse.click(195, 420)
    ys = g.evaluate("""async () => { const card = Array.from(document.querySelectorAll('[data-dc="Abertura"] span')).find(s => (s.getAttribute('style') || '').includes('height: 186px'));
      if (!card) return []; const out = []; const t0 = performance.now();
      await new Promise((res) => { const f = () => { const m = getComputedStyle(card).transform; out.push(m === 'none' ? 0 : parseFloat(m.split(',')[5])); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      return out; }""")
    mid = [y for y in ys if -165 < y < -5]
    ok('Abertura (link do convidado): a carta anima até abrir', len(ys) > 10 and ys[0] > -5 and len(mid) >= 3, (ys[:3], len(mid)))
    ctx.close()


SHOTS = os.environ.get('SHOTS', '')


def shot(pg, name):
    if SHOTS:
        pg.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=True)


def t_personal(pg, browser):
    go(pg, 'Temas', 1300)
    pg.click('[aria-label="Tema Jardim"]'); pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(2000)
    wait_saved(pg)
    pid = pg.url.split('#/Editor/')[1]
    pg.fill('#inv-title', 'Casamento Personalizado')
    pg.click('button[role=tab]:has-text("Evento")'); pg.wait_for_timeout(200)
    ok('Personalização: desligada por padrão', not pg.is_checked('#pers-on'))
    pg.check('#pers-on'); pg.wait_for_timeout(200)
    pg.fill('#pers-greeting', 'Querida {nome}, você recebeu um convite'); pg.press('#pers-greeting', 'Tab')
    shot(pg, 'p1_editor')
    wait_saved(pg)
    pg.click('button:has-text("Criar convites individuais")'); pg.wait_for_timeout(1500)
    ok('Personalização: abre a tela de convites individuais', 'Convidados/' + pid in pg.url and 'Convites individuais' in text(pg))
    pg.fill('#g-name', 'Família Silva'); pg.fill('#g-people', 'João Silva\nMaria Silva'); pg.fill('#g-comp', '1')
    ok('Convidados: mostra o total de pessoas', 'Até 3 pessoas' in text(pg))
    pg.click('button:has-text("Adicionar convite")'); pg.wait_for_timeout(800)
    ok('Convidados: convite criado', count(pg, 'li[data-guest]') == 1 and 'Família Silva' in text(pg))
    pg.click('button:has-text("Adicionar vários de uma vez")')
    pg.fill('#g-bulk', 'Carlos Souza +1\nTios: Ana Lima, Beto Lima\n\n')
    pg.click('button:has-text("Adicionar 2 convites")'); pg.wait_for_timeout(800)
    ok('Convidados: vários de uma vez', count(pg, 'li[data-guest]') == 3 and 'Tios' in text(pg) and 'Carlos Souza' in text(pg))
    shot(pg, 'p2_convidados')
    # editar o limite do Carlos
    pg.click('[aria-label="Editar Carlos Souza"]'); pg.wait_for_timeout(200)
    pg.locator('li[data-guest] input[type=number]').first.fill('2'); pg.click('button:has-text("Salvar")'); pg.wait_for_timeout(600)
    ok('Convidados: editar acompanhantes', 'Até 3 pessoas (2 acompanhantes extras)' in pg.inner_text('li[data-guest]:has-text("Carlos Souza")'))
    silva = pg.get_attribute('li[data-guest]:has-text("Família Silva")', 'data-guest')
    tios = pg.get_attribute('li[data-guest]:has-text("Tios")', 'data-guest')
    # publicar
    go(pg, 'Editor/' + pid, 1800)
    pg.click('header button:has-text("Publicar")'); wait_saved(pg)
    # convidado: Família Silva
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + pid + '/' + silva); g.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000); g.wait_for_timeout(500)
    dest = g.inner_text('[data-testid="destinatario"]') if count(g, '[data-testid="destinatario"]') else ''
    ok('Abertura individual: nome escrito no próprio convite', 'Família Silva' in dest and 'Querida' in dest.title(), dest)
    ok('Abertura individual: faixa do topo sem o nome', 'Família Silva'.upper() not in g.inner_text('[data-dc="Abertura"] span[style*="text-transform: uppercase"][style*="pointer-events: none"]').upper() if count(g, '[data-dc="Abertura"] span[style*="pointer-events: none"][style*="text-transform: uppercase"]') else True)
    ok('Abertura individual: nome na fonte do tema', 'Cormorant' in g.evaluate("getComputedStyle(document.querySelector('[data-testid=destinatario] span:nth-child(2)')).fontFamily"))
    shot(g, 'p3_abertura')
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2600)
    g.click('nav button:has-text("Presença")'); g.wait_for_timeout(500)
    ok('RSVP individual: sem campo de nome único', count(g, 'label:has-text("Nome completo")') == 0 and 'Convite para Família Silva' in text(g))
    people = g.locator('[data-testid="rsvp-people"] [data-person]')
    ok('RSVP individual: uma resposta por convidado', people.count() == 2 and 'João Silva' in people.nth(0).inner_text() and 'Maria Silva' in people.nth(1).inner_text())
    ok('RSVP individual: botão de acompanhante na mesma lista, antes de responder', count(g, '[data-testid="rsvp-people"] [data-testid="add-extra"]') == 1 and count(g, '[data-extra]') == 0)
    g.click('[data-testid="add-extra"]'); g.wait_for_timeout(200)
    ok('RSVP individual: acompanhante adicionado como linha da lista (limite 1)', count(g, '[data-testid="rsvp-people"] [data-extra]') == 1 and count(g, '[data-testid="add-extra"]') == 0)
    g.locator('[data-extra] input').nth(0).fill('Pedro Silva')
    people.nth(1).locator('button:has-text("Não vai")').click(); g.wait_for_timeout(150)
    people.nth(0).locator('button:has-text("Não vai")').click(); g.wait_for_timeout(150)
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(300)
    ok('RSVP individual: acompanhante precisa de um convidado indo', 'pelo menos um convidado' in text(g))
    # recomeça com o formulário limpo para testar a exigência de responder por pessoa
    g.goto('about:blank'); g.goto(BASE + '#/c/' + pid + '/' + silva); g.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2600)
    g.click('nav button:has-text("Presença")'); g.wait_for_timeout(400)
    people = g.locator('[data-testid="rsvp-people"] [data-person]')
    people.nth(0).locator('button:has-text("Vai")').first.click(); g.wait_for_timeout(150)
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(300)
    ok('RSVP individual: exige resposta para cada pessoa', 'para cada pessoa' in text(g))
    people.nth(1).locator('button:has-text("Não vai")').click(); g.wait_for_timeout(150)
    g.click('[data-testid="add-extra"]'); g.wait_for_timeout(150)
    g.locator('[data-extra] input').nth(0).fill('Pedro Silva')
    shot(g, 'p4_rsvp')
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(900)
    ok('RSVP individual: confirma só quem vai', 'Reservamos 2 lugares: João Silva e Pedro Silva. Não vai: Maria Silva.' in text(g), text(g)[-220:])
    shot(g, 'p5_done')
    # em outro aparelho, a resposta continua (vem do servidor)
    g2 = browser.new_context(viewport={'width': 390, 'height': 844}).new_page()
    g2.goto(BASE + '#/c/' + pid + '/' + silva); g2.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000)
    g2.click('[aria-label="Toque para abrir o convite"]'); g2.wait_for_timeout(2600)
    g2.click('nav button:has-text("Presença")'); g2.wait_for_timeout(400)
    ok('RSVP individual: resposta aparece em outro aparelho', 'Presença confirmada' in text(g2))
    g2.click('button:has-text("Alterar minha resposta")'); g2.wait_for_timeout(300)
    p2 = g2.locator('[data-testid="rsvp-people"] [data-person]')
    ok('RSVP individual: alterar mostra as respostas anteriores', p2.nth(0).locator('button[aria-pressed="true"]').inner_text() == 'Vai' and p2.nth(1).locator('button[aria-pressed="true"]').inner_text() == 'Não vai' and g2.locator('[data-extra] input').nth(0).input_value() == 'Pedro Silva')
    p2.nth(1).locator('button:has-text("Vai")').first.click(); g2.click('[data-extra] button:has-text("Remover")'); g2.wait_for_timeout(150)
    ok('RSVP individual: remover acompanhante volta o botão', count(g2, '[data-extra]') == 0 and count(g2, '[data-testid="add-extra"]') == 1)
    g2.click('button:has-text("Enviar resposta")'); g2.wait_for_timeout(900)
    ok('RSVP individual: alterar para os dois convidados', 'Reservamos 2 lugares: João Silva e Maria Silva.' in text(g2), text(g2)[-200:])
    g2.context.close()
    # convite sem acompanhantes
    g.goto('about:blank'); g.goto(BASE + '#/c/' + pid + '/' + tios); g.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2600)
    g.click('nav button:has-text("Presença")'); g.wait_for_timeout(400)
    tp = g.locator('[data-testid="rsvp-people"] [data-person]')
    tp.nth(0).locator('button:has-text("Vai")').first.click(); g.wait_for_timeout(150)
    ok('RSVP individual: Tios tem 2 pessoas e nenhum acompanhante', tp.count() == 2 and count(g, '[data-testid="add-extra"]') == 0)
    tp.nth(1).locator('button:has-text("Não vai")').click()
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(900)
    ok('RSVP individual: Tios confirma só Ana', 'Reservamos 1 lugar: Ana Lima. Não vai: Beto Lima.' in text(g), text(g)[-200:])
    ctx.close()
    # link geral bloqueado quando a opção estiver desmarcada
    go(pg, 'Editor/' + pid, 1800)
    pg.click('button[role=tab]:has-text("Evento")'); pg.wait_for_timeout(200)
    pg.uncheck('#pers-generic'); wait_saved(pg)
    gg = browser.new_context(viewport={'width': 390, 'height': 844}).new_page()
    gg.goto(BASE + '#/c/' + pid); gg.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000)
    gg.click('[aria-label="Toque para abrir o convite"]'); gg.wait_for_timeout(2600)
    gg.click('nav button:has-text("Presença")'); gg.wait_for_timeout(400)
    ok('Link geral: pede o link individual', 'use o link do convite individual' in text(gg))
    gg.context.close()
    # painel e respostas
    go(pg, 'Convidados/' + pid, 1500)
    row = pg.inner_text('li[data-guest]:has-text("Família Silva")')
    ok('Convidados: situação e nomes confirmados', 'Vai' in row and 'Vão (2): João Silva, Maria Silva' in row, row)
    row2 = pg.inner_text('li[data-guest]:has-text("Tios")')
    ok('Convidados: mostra quem não vai', 'Vão (1): Ana Lima' in row2 and 'Não vão: Beto Lima' in row2, row2)
    go(pg, 'Respostas/' + pid, 1500)
    ok('Respostas: mostra quem vai no convite individual', 'Família Silva' in text(pg) and 'Vão: João Silva, Maria Silva' in text(pg) and 'Não vão: Beto Lima' in text(pg))
    go(pg, 'Main', 1500)
    ok('Painel: atalho para convidados', count(pg, 'article:has-text("Casamento Personalizado") a:has-text("Convidados")') == 1)
    # excluir convite individual
    go(pg, 'Convidados/' + pid, 1500)
    pg.click('[aria-label="Excluir Carlos Souza"]'); pg.click('button:has-text("Confirmar exclusão")'); pg.wait_for_timeout(600)
    ok('Convidados: excluir', count(pg, 'li[data-guest]') == 2)


def t_logout(pg):
    go(pg, 'Main', 1200)
    pg.click('button:has-text("Sair")'); pg.wait_for_timeout(900)
    ok('Sair volta ao login', count(pg, '#pw') == 1)
    pg.fill('#pw', PASSWORD); pg.click('button:has-text("Entrar")'); pg.wait_for_timeout(1000)


def t_mobile(pg):
    pg.set_viewport_size({'width': 390, 'height': 844})
    for r in ['Main', 'Temas', 'CriarTema', 'Respostas']:
        go(pg, r, 1200)
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok('Celular sem rolagem lateral: ' + r, sw <= 392, sw)
    pg.set_viewport_size({'width': 1280, 'height': 900})


def main():
  with sync_playwright() as p:
      b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
      ctx = b.new_context(viewport={'width': 1280, 'height': 900}, accept_downloads=True)
      pg = ctx.new_page()
      pg.set_default_timeout(6000)
      pg.on('pageerror', lambda e: errors.append(str(e)))
      pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_' not in m.text else None)
      for name, fn, arg in [('login', t_login, pg), ('criar', t_create, pg), ('editar', t_edit_persist, pg), ('prévia', t_preview, pg),
                            ('rascunho', t_unpublished_guest, b), ('publicar', t_publish, pg), ('convidado', t_guest, b),
                            ('respostas', t_rsvps, pg), ('painel', t_dashboard, pg), ('desfazer', t_undo, pg),
                            ('trocar tema', t_change_theme, pg), ('tema próprio', t_custom_theme, pg), ('abertura', lambda: t_opening(pg, b), None), ('fotos', lambda: t_photos(pg, b), None), ('arrastar', lambda: t_dnd(pg, b), None), ('carregamento', lambda: t_loading(pg, b), None), ('faixas', t_tap_margin, b), ('animação', t_open_anim, b), ('personalizado', lambda: t_personal(pg, b), None), ('sair', t_logout, pg), ('celular', t_mobile, pg)]:
          safe(name, fn, arg)
      b.close()

  fails = [r for r in results if not r[0]]
  print('TOTAL', len(results), 'OK', len(results) - len(fails), 'FALHAS', len(fails))
  for r in fails:
      print('FALHOU:', r[1], '|', r[2])
  print('ERROS JS:', len(errors))
  for e in sorted(set(errors))[:15]:
      print('  ', e[:300])


if __name__ == '__main__':
    main()
