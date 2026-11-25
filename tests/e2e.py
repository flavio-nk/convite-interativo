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
    if os.environ.get('E2E_VERBOSE') and not cond:
        print('  ✗', name, '|', str(info)[:200], flush=True)


def safe(name, fn, *a):
    try:
        return fn(*a) if a and a[0] is not None else fn()
    except Exception as e:  # noqa
        results.append((False, name + ' [exceção]', str(e).split('\n')[0][:220]))
        if os.environ.get('E2E_VERBOSE'):
            print('  ✗', name, '[exceção]', str(e).split('\n')[0][:200], flush=True)


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


# ---------- atalhos para a interface nova ----------
TAB_MAP = {'Bloco': ('Conteúdo', None), 'Tema': ('Aparência', 'tema'), 'Música': ('Aparência', 'musica'), 'Abertura': ('Aparência', 'abertura'), 'Evento': ('Evento', None)}


def tab(pg, old):
    """Abre a aba do painel do editor (nomes antigos: Bloco, Tema, Música, Abertura, Evento)."""
    label, sec = TAB_MAP.get(old, (old, None))
    pg.click('aside[aria-label="Propriedades"] button[role=tab]:has-text("' + label + '")'); pg.wait_for_timeout(120)
    if sec:
        btn = pg.locator('[data-testid="ap-' + sec + '"]')
        if btn.get_attribute('aria-expanded') != 'true':
            btn.click(); pg.wait_for_timeout(150)


def page_sec(pg):
    btn = pg.locator('[data-testid="page-toggle"]')
    if btn.get_attribute('aria-expanded') != 'true':
        btn.click(); pg.wait_for_timeout(150)


def adv(pg):
    btn = pg.locator('[data-testid="adv-toggle"]')
    if btn.count() and btn.get_attribute('aria-expanded') != 'true':
        btn.click(); pg.wait_for_timeout(150)


def add_block(pg, label):
    pg.click('[data-testid="add-block"]'); pg.wait_for_timeout(120)
    pg.click('button.addb[aria-label="' + label + '"]'); pg.wait_for_timeout(200)


def publish(pg):
    pg.click('[data-testid="publish-btn"]'); pg.wait_for_timeout(300)
    if pg.locator('[data-testid="pub-confirm"]').count():
        pg.click('[data-testid="pub-confirm"]'); pg.wait_for_timeout(300)
    wait_saved(pg)
    if pg.locator('[aria-labelledby="pub-title"]').count():
        pg.click('[aria-labelledby="pub-title"] [aria-label="Fechar"]'); pg.wait_for_timeout(200)


def new_invite(pg, theme, kind='Outro', names='', wait=2000):
    """Cria um convite pelo caminho novo: galeria › dados do evento › tema › editor."""
    go(pg, 'Temas', 1200)
    pg.click('[aria-label="Tema ' + theme + '"]'); pg.click('button:has-text("Usar este tema")'); pg.wait_for_timeout(800)
    pg.click('button.nv-type:has-text("' + kind + '")')
    if names:
        pg.fill('#nv-names', names)
    pg.click('button:has-text("Escolher o visual")'); pg.wait_for_timeout(1200)
    pg.click('button:has-text("Criar convite")'); pg.wait_for_timeout(wait)


def go_rsvp(g):
    g.click('nav[aria-label="Páginas do convite"] button[data-rsvp-tab="1"], nav[aria-label="Páginas do convite"] button:has-text("Presença")'); g.wait_for_timeout(100)


def open_menu(pg, title):
    pg.click('article:has-text("' + title + '") [aria-label^="Mais ações"]'); pg.wait_for_timeout(150)


def logout(pg):
    pg.click('[data-testid="user-menu"]'); pg.wait_for_timeout(150)
    pg.click('[role=menu] button:has-text("Sair")')


state = {}


def t_login(pg):
    go(pg, 'Main')
    ok('Login: pede usuário e senha', count(pg, '#user') == 1 and count(pg, '#pw') == 1)
    pg.fill('#pw', 'segredo123')
    ok('Login: senha começa escondida', pg.get_attribute('#pw', 'type') == 'password' and count(pg, 'button[aria-label="Mostrar senha"]') == 1)
    pg.click('button[aria-label="Mostrar senha"]')
    ok('Login: olho mostra a senha digitada', pg.get_attribute('#pw', 'type') == 'text' and pg.input_value('#pw') == 'segredo123' and pg.get_attribute('button.pweye', 'aria-pressed') == 'true')
    pg.click('button[aria-label="Ocultar senha"]')
    ok('Login: olho esconde de novo', pg.get_attribute('#pw', 'type') == 'password' and pg.input_value('#pw') == 'segredo123')
    pg.fill('#user', 'admin'); pg.fill('#pw', 'errada'); pg.click('button:has-text("Entrar")'); pg.wait_for_timeout(900)
    ok('Login: senha errada recusada', 'Usuário ou senha incorretos' in text(pg))
    pg.fill('#pw', PASSWORD); pg.click('button:has-text("Entrar")'); pg.wait_for_timeout(1000)
    ok('Login: entra no painel (administrador vê todos os convites)', 'Todos os convites' in text(pg) and count(pg, 'nav a:has-text("Usuários")') == 1)


def t_create(pg):
    go(pg, 'Main')
    pg.click('a.newbtn'); pg.wait_for_timeout(900)
    ok('Novo convite começa pelos dados do evento', count(pg, 'h1:has-text("Conte sobre o evento")') == 1 and count(pg, 'button.nv-type') == 8)
    pg.click('button:has-text("Escolher o visual")'); pg.wait_for_timeout(300)
    ok('Novo convite: pede o tipo de evento', 'Escolha o tipo de evento' in text(pg))
    pg.click('button.nv-type:has-text("Aniversário")')
    ok('Novo convite: rótulo do nome muda com o tipo', 'Nome do aniversariante' in text(pg))
    pg.fill('#nv-names', 'Carla'); pg.fill('#nv-day', '2027-03-12'); pg.fill('#nv-time', '20:00'); pg.fill('#nv-place', 'Bar do Zé')
    pg.click('button:has-text("Escolher o visual")'); pg.wait_for_timeout(1300)
    ok('Tema: galeria filtrada pelo tipo, sem tema marcado', count(pg, 'button[aria-pressed="true"]:has-text("Aniversário")') == 1 and count(pg, '.tcard[aria-pressed="true"]') == 0 and 'Toque em um tema para escolher' in text(pg))
    ok('Tema: miniaturas com os dados digitados', count(pg, '.tcard:has-text("Carla")') >= 3 and count(pg, '.tcard:has-text("12 · 03 · 2027")') >= 3)
    pg.click('a:has-text("Voltar")'); pg.wait_for_timeout(700)
    ok('Voltar mantém o que foi digitado', pg.input_value('#nv-names') == 'Carla' and pg.input_value('#nv-place') == 'Bar do Zé')
    pg.click('button:has-text("Escolher o visual")'); pg.wait_for_timeout(1200)
    pg.click('[aria-label="Tema Neon"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Criar convite")'); pg.wait_for_timeout(2200)
    ok('Criar convite abre o editor', '#/Editor/' in pg.url, pg.url)
    state['id'] = pg.url.split('#/Editor/')[1].split('?')[0]
    ok('Editor: título com o evento', pg.input_value('#inv-title') == 'Aniversário de Carla', pg.input_value('#inv-title'))
    wait_saved(pg)
    ok('Editor: páginas iniciais salvas', 'todas as alterações salvas' in text(pg))
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", state['id'])
    blocks = [b for p in inv['pages'] for b in p['blocks']]
    capa = [b for b in inv['pages'][0]['blocks'] if b['type'] == 'titulo'][0]
    mp = [b for b in blocks if b['type'] == 'mapa'][0]
    ok('Convite nasce com os dados: nome, data, local e prazo', capa['text'] == 'Carla' and inv['eventDate'] and mp['text'] == 'Bar do Zé' and any(b['type'] == 'rsvp' and b.get('deadline') for b in blocks), [capa['text'], inv['eventDate'], mp['text']])
    ok('Convite nasce sem "[data limite]"', not any('[data limite]' in (b.get('text') or '') for b in blocks))


def t_edit_persist(pg):
    iid = state['id']
    go(pg, 'Editor/' + iid, 1500)
    pg.fill('#inv-title', 'Festa de Teste')
    pg.click('.blk >> nth=1'); pg.wait_for_timeout(150)
    pg.fill('#blk-text', 'Joana & Bruno')
    pg.click('.blk >> nth=0'); pg.wait_for_timeout(150)
    pg.set_input_files('#media-file', FIX + 'foto.png')
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando foto.png')", timeout=10000)
    ok('Prontidão: mostra quanto falta para publicar', 'Pronto para publicar' in pg.inner_text('[data-testid="ready-chip"]'))
    tab(pg, 'Evento')
    pg.fill('#ev-kicker', 'Casamento')
    pg.fill('#ev-day', '2027-05-20'); pg.wait_for_timeout(150)
    ok('Data: só a data mantém o horário já definido', pg.input_value('#ev-time') == '20:00' and 'Quinta-feira, 20 de maio de 2027, às 20h' in pg.inner_text('[data-testid="ev-summary"]'), pg.inner_text('[data-testid="ev-summary"]'))
    pg.click('[data-testid="ev-quick"] button:text-is("16h")'); pg.wait_for_timeout(150)
    ok('Data: horário comum com um toque', pg.input_value('#ev-time') == '16:00')
    pg.fill('#ev-time', '17:30'); pg.wait_for_timeout(150)
    ok('Data: resumo com contagem de dias', 'Faltam' in pg.inner_text('[data-testid="ev-summary"]'), pg.inner_text('[data-testid="ev-summary"]'))
    ok('Prazo para responder no painel Evento', pg.input_value('#ev-deadline') != '')
    tab(pg, 'Música'); pg.wait_for_timeout(150)
    ok('Música: só sem música ou enviar arquivo', count(pg, '[data-testid="mus-drop"]') == 1 and 'Biblioteca' not in pg.inner_text('aside >> nth=-1') and 'Link do áudio' not in text(pg) and 'Sem música' in pg.inner_text('[data-testid="ap-musica"]'))
    pg.set_input_files('#mus-file', FIX + 'tom.wav')
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando…')", timeout=10000)
    ok('Música: arquivo enviado aparece com ouvir, trocar e remover', count(pg, '[data-testid="mus-track"]') == 1 and 'tom.wav' in pg.inner_text('[data-testid="mus-track"]') and count(pg, 'label:has-text("Trocar música")') == 1)
    pg.click('button:has-text("Remover música")'); pg.wait_for_timeout(150)
    ok('Música: remover volta para sem música', count(pg, '[data-testid="mus-drop"]') == 1 and 'Sem música' in pg.inner_text('[data-testid="ap-musica"]'))
    pg.set_input_files('#mus-file', FIX + 'tom.wav')
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando…')", timeout=10000)
    tab(pg, 'Tema'); pg.wait_for_timeout(150)
    pg.click('[aria-label="Paleta Oceano"]')
    tab(pg, 'Bloco')
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
    tab(pg, 'Música')
    ok('Recarregar: música salva', 'tom.wav' in pg.inner_text('[data-testid="ap-musica"]'))
    tab(pg, 'Tema'); pg.wait_for_timeout(150)
    ok('Recarregar: paleta salva', pg.input_value('#tc-bg').lower() == '#0b3c5d', pg.input_value('#tc-bg'))
    tab(pg, 'Evento'); pg.wait_for_timeout(150)
    ok('Recarregar: data do evento salva', pg.input_value('#ev-day') == '2027-05-20' and pg.input_value('#ev-time') == '17:30', [pg.input_value('#ev-day'), pg.input_value('#ev-time')])
    tab(pg, 'Bloco')
    pg.click('button.pg:has-text("Detalhes")'); pg.wait_for_timeout(150)
    pg.click('[aria-label^="Bloco Mapa"]'); pg.wait_for_timeout(150)
    ok('Recarregar: endereço do mapa salvo', pg.input_value('#map-addr') == 'Rua das Acácias, 100, Campinas')


def t_preview(pg):
    go(pg, 'Editor/' + state['id'], 1500)
    pg.click('header button:has-text("Ver como convidado")'); pg.wait_for_timeout(600)
    dlg = '[aria-label="Pré-visualização do convite"]'
    ok('Pré-visualizar abre', count(pg, dlg) == 1)
    ok('Pré-visualizar: pergunta se quer abrir com som', count(pg, dlg + ' [data-testid="pergunta-som"]') == 1)
    pg.click(dlg + ' [data-som="sim"]'); pg.wait_for_timeout(500)
    pg.click(dlg + ' [aria-label="Toque para abrir o convite"]'); pg.wait_for_timeout(3000)
    ok('Pré-visualizar: abre e mostra o conteúdo editado', count(pg, dlg + ' >> text=Joana & Bruno') >= 1)
    ok('Pré-visualizar: música ativa', count(pg, dlg + ' [aria-label="Pausar música"]') == 1)
    pg.click('[aria-label="Pré-visualização do convite"] [aria-label="Fechar"]')


def t_unpublished_guest(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    g = ctx.new_page()
    g.goto(BASE + '#/c/' + state['id']); g.wait_for_timeout(1500)
    ok('Convidado: rascunho não abre', 'Convite indisponível' in g.inner_text('body'))
    ctx.close()


def t_publish(pg):
    go(pg, 'Editor/' + state['id'], 1500)
    publish(pg)
    ok('Publicar: revisão antes e link para compartilhar depois', True)
    pg.click('[data-testid="publish-btn"]'); pg.wait_for_timeout(500)
    ok('Publicado: botão vira Compartilhar e mostra o link curto', count(pg, '[data-testid="share-link"]') == 1 and '/c/' + state['id'] in pg.inner_text('[data-testid="share-link"]'), pg.inner_text('body')[:200])
    pg.click('[data-testid="share-link"] ~ button:has-text("Personalizar")'); pg.wait_for_timeout(200)
    pg.fill('#shr-slug', 'festa-de-teste'); pg.click('button:has-text("Salvar link")'); pg.wait_for_timeout(800)
    ok('Link curto personalizado', 'c/festa-de-teste' in pg.inner_text('[data-testid="share-link"]'), pg.inner_text('[data-testid="share-link"]'))
    pg.click('button:has-text("QR code")'); pg.wait_for_timeout(300)
    ok('QR code do link', count(pg, '[data-testid="share-qr"] svg path') == 1 and len(pg.get_attribute('[data-testid="share-qr"] svg path', 'd')) > 200)
    pg.click('[aria-labelledby="pub-title"] [aria-label="Fechar"]'); pg.wait_for_timeout(200)


def t_guest(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
    g = ctx.new_page()
    g.on('pageerror', lambda e: errors.append('convidado: ' + str(e)))
    g.goto(BASE + '#/c/' + state['id']); g.wait_for_timeout(1800)
    ok('Convidado: antes de abrir, pergunta se quer com som', count(g, '[data-testid="pergunta-som"]') == 1 and 'Este convite tem música' in g.inner_text('body') and count(g, '[aria-label="Toque para abrir o convite"]') == 0)
    ok('Convidado: foco em "Abrir com som"', g.evaluate("() => document.activeElement && document.activeElement.dataset.som") == 'sim')
    # sem som: abre sem música, com o botão para ligar depois
    g.click('[data-som="nao"]'); g.wait_for_timeout(400)
    ok('Convidado: depois da resposta, a abertura aparece (ainda fechada)', count(g, '[data-testid="pergunta-som"]') == 0 and count(g, '[aria-label="Toque para abrir o convite"]') == 1 and count(g, 'h1:has-text("Joana & Bruno")') == 0)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(3200)
    ok('Convidado: "sem som" abre sem música (botão para ligar)', count(g, '[aria-label="Tocar música"]') == 1 and count(g, '[aria-label="Pausar música"]') == 0)
    g.click('[aria-label="Tocar música"]'); g.wait_for_timeout(300)
    ok('Convidado: dá para ligar a música depois', count(g, '[aria-label="Pausar música"]') == 1)
    g.reload(); g.wait_for_timeout(1800)
    ok('Convidado: pergunta de novo ao abrir outra vez', count(g, '[data-testid="pergunta-som"]') == 1)
    g.click('[data-som="sim"]'); g.wait_for_timeout(400)
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
    go_rsvp(g); g.wait_for_timeout(500)
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
    g.click('[data-som="nao"]'); g.wait_for_timeout(300)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(3200)
    go_rsvp(g); g.wait_for_timeout(500)
    ok('Convidado: ao voltar, resposta lembrada', 'Presença confirmada' in g.inner_text('body'))
    g.click('text=Alterar minha resposta'); g.wait_for_timeout(200)
    ok('Convidado: alterar traz o nome', g.input_value('input[autocomplete=name]') == 'Carlos Convidado')
    g.click('button:has-text("Não poderei ir")'); g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(1200)
    ok('Convidado: altera para não vai', 'Resposta enviada' in g.inner_text('body'))
    # segundo convidado, outro aparelho
    ctx2 = browser.new_context(viewport={'width': 390, 'height': 844})
    g2 = ctx2.new_page()
    g2.goto(BASE + '#/c/' + state['id']); g2.wait_for_timeout(1500)
    g2.click('[data-som="nao"]'); g2.wait_for_timeout(300)
    g2.click('[aria-label="Toque para abrir o convite"]'); g2.wait_for_timeout(3200)
    go_rsvp(g2); g2.wait_for_timeout(500)
    g2.fill('input[autocomplete=name]', 'Dora Silva'); g2.click('button:has-text("Sim, eu vou")')
    g2.click('button:has-text("Enviar resposta")'); g2.wait_for_timeout(1200)
    ok('Segundo convidado responde', 'Presença confirmada' in g2.inner_text('body'))
    sw = g2.evaluate('document.documentElement.scrollWidth')
    ok('Convidado no celular sem rolagem lateral', sw <= 392, sw)
    ctx2.close(); ctx.close()


def t_rsvps(pg):
    go(pg, 'Respostas/' + state['id'], 1500)
    ok('Respostas: 2 linhas', count(pg, 'li[data-item]') == 2, count(pg, 'li[data-item]'))
    body = text(pg)
    ok('Respostas: resposta alterada aparece como Não vai', 'Carlos Convidado' in body and 'Não vai' in body)
    ok('Respostas: Dora confirmada', 'Dora Silva' in body)
    with pg.expect_download() as d:
        pg.click('button:has-text("Baixar planilha")')
    csv = open(d.value.path(), encoding='utf-8-sig').read()
    ok('Respostas: planilha com dados reais', 'Dora Silva' in csv and 'Carlos Convidado' in csv)
    ok('Convidados: sem botão de registrar resposta avulsa', count(pg, 'button:has-text("+ Registrar resposta")') == 0)
    ok('Convidados: resumo com pessoas confirmadas, barra e prazo', 'pessoas confirmadas' in text(pg) or 'pessoa confirmada' in text(pg))
    ok('Convidados: prazo de resposta em destaque', 'Prazo de resposta' in text(pg))
    ok('Convidados: abas do convite', count(pg, '[role=tablist] >> text=Editar') == 1 and count(pg, 'button[role=tab]:has-text("Compartilhar")') == 1)
    # o organizador edita uma resposta
    pg.click('[aria-label="Editar resposta de Dora Silva"]'); pg.wait_for_timeout(200)
    ok('Painel: editar resposta do convidado traz os dados', pg.input_value('#an-name-e') == 'Dora Silva')
    pg.fill('form[data-answer] input[placeholder="Ex.: vegetariano"]', 'sem lactose')
    pg.click('form[data-answer] button:has-text("Salvar resposta")'); pg.wait_for_timeout(700)
    row = pg.inner_text('li[data-item]:has-text("Dora Silva")')
    ok('Painel: resposta editada pelo organizador', 'sem lactose' in row and 'registrada por você' in row, row)


def t_dashboard(pg):
    go(pg, 'Main', 1500)
    ok('Painel: convite salvo na lista', count(pg, 'article:has-text("Festa de Teste")') == 1)
    card = pg.inner_text('article:has-text("Festa de Teste")')
    ok('Painel: cartão no ar mostra o resumo das respostas', count(pg, 'article:has-text("Festa de Teste") [data-testid="card-stats"]') == 1 and 'vai' in card, card)
    ok('Painel: data do evento', 'Qui, 20 mai 2027 · 17h30' in card, card)
    ok('Painel: botão principal leva às respostas', count(pg, 'article:has-text("Festa de Teste") a:has-text("Ver respostas")') == 1)
    pg.fill('#busca-convite', 'zzz'); pg.wait_for_timeout(200)
    ok('Painel: busca filtra', count(pg, 'article[data-invite]') == 0 and 'Nenhum convite encontrado' in text(pg))
    pg.fill('#busca-convite', 'festa'); pg.wait_for_timeout(200)
    ok('Painel: busca encontra', count(pg, 'article:has-text("Festa de Teste")') == 1)
    pg.fill('#busca-convite', '')
    open_menu(pg, 'Festa de Teste')
    ok('Painel: ações raras ficam no menu ⋯', count(pg, '[role=menu] >> text=Duplicar') == 1)
    pg.click('[role=menu] >> text=Duplicar'); pg.wait_for_timeout(1500)
    ok('Painel: duplicar cria uma cópia em preparo', count(pg, 'article:has-text("Cópia de Festa de Teste")') == 1 and 'Em preparo' in pg.inner_text('article:has-text("Cópia de Festa de Teste")'))
    open_menu(pg, 'Cópia de Festa de Teste')
    pg.click('[aria-label="Excluir Cópia de Festa de Teste"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Excluir convite")'); pg.wait_for_timeout(900)
    open_menu(pg, 'Festa de Teste')
    pg.click('[aria-label="Excluir Festa de Teste"]'); pg.wait_for_timeout(200)
    pg.click('[role=dialog] [aria-label="Fechar"]'); pg.wait_for_timeout(200)
    ok('Painel: X fecha o modal de exclusão', count(pg, '[role=dialog]') == 0 and 'Festa de Teste' in text(pg))
    open_menu(pg, 'Festa de Teste')
    pg.click('[aria-label="Excluir Festa de Teste"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Excluir convite")'); pg.wait_for_timeout(900)
    ok('Painel: excluir remove', count(pg, 'article:has-text("Festa de Teste")') == 0)
    pg.reload(); pg.wait_for_timeout(1500)
    ok('Painel: exclusão persiste', count(pg, 'article:has-text("Festa de Teste")') == 0)
    g = pg.evaluate("() => fetch('/api/invites?id=festa-de-teste').then(r => r.status)")
    ok('Link curto deixa de funcionar ao excluir', g == 404, g)


def t_undo(pg):
    # cria e exclui outro para testar o desfazer
    go(pg, 'Temas', 1200)
    new_invite(pg, 'Jardim', wait=1800)
    wait_saved(pg)
    go(pg, 'Main', 1500)
    open_menu(pg, 'Novo convite · Jardim')
    pg.click('[aria-label^="Excluir Novo convite · Jardim"]'); pg.wait_for_timeout(200)
    pg.click('button:has-text("Excluir convite")'); pg.wait_for_timeout(900)
    pg.click('text=Desfazer'); pg.wait_for_timeout(1500)
    ok('Desfazer restaura o convite', count(pg, 'article:has-text("Novo convite · Jardim")') == 1)
    pg.reload(); pg.wait_for_timeout(1500)
    ok('Desfazer persiste', count(pg, 'article:has-text("Novo convite · Jardim")') == 1)


def t_change_theme(pg):
    go(pg, 'Main', 1500)
    pg.click('article:has-text("Novo convite · Jardim") a:has-text("Continuar editando")'); pg.wait_for_timeout(1500)
    eid = pg.url.split('#/Editor/')[1]
    tab(pg, 'Tema'); pg.click('button:has-text("Trocar tema base")'); pg.wait_for_timeout(1300)
    ok('Trocar tema abre galeria em modo troca', 'Trocar o tema do convite' in text(pg))
    pg.click('[aria-label="Tema Tropical"]'); pg.click('button:has-text("Aplicar ao convite")'); pg.wait_for_timeout(1800)
    ok('Trocar tema volta ao mesmo convite', pg.url.endswith('#/Editor/' + eid), pg.url)
    tab(pg, 'Tema'); pg.wait_for_timeout(150)
    ok('Trocar tema aplica Tropical', pg.input_value('#th-layout') == 'dividido' and 'Tropical' in text(pg))


def t_custom_theme(pg):
    go(pg, 'CriarTema', 1200)
    pg.fill('#t-name', 'Tema Salvo E2E'); pg.click('[aria-label="Paleta Café"]')
    pg.click('button:has-text("Salvar tema")'); pg.wait_for_timeout(900)
    ok('Criar tema: salvo', 'salvo em Temas criados' in text(pg))
    go(pg, 'Temas', 1300)
    pg.click('button[aria-pressed]:has-text("Temas criados")'); pg.wait_for_timeout(300)
    ok('Temas criados lista o tema salvo', count(pg, '[aria-label="Tema Tema Salvo E2E"]') == 1)
    pg.click('[aria-label="Tema Tema Salvo E2E"]'); pg.click('button:has-text("Editar tema")'); pg.wait_for_timeout(1300)
    ok('Editar tema carrega dados', pg.input_value('#t-name') == 'Tema Salvo E2E' and pg.input_value('#c-bg').lower() == '#3b2a20')
    pg.click('button:has-text("Excluir tema")'); pg.click('[role=alert] button:has-text("Excluir")'); pg.wait_for_timeout(1300)
    pg.click('button[aria-pressed]:has-text("Temas criados")'); pg.wait_for_timeout(300)
    ok('Excluir tema', count(pg, '[aria-label="Tema Tema Salvo E2E"]') == 0)


def t_opening(pg, browser):
    go(pg, 'Temas', 1300)
    new_invite(pg, 'Jardim', wait=1800)
    wait_saved(pg)
    oid = pg.url.split('#/Editor/')[1]
    tab(pg, 'Abertura'); pg.wait_for_timeout(300)
    ok('Abertura: aba existe e mostra a prévia fechada', count(pg, '#op-anim') == 1 and count(pg, 'main [aria-label="Toque para abrir o convite"]') == 1)
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
    tab(pg, 'Abertura'); pg.wait_for_timeout(300)
    ok('Abertura: configurações salvas', pg.input_value('#op-anim') == 'lacre' and pg.input_value('#op-trigger') == 'botao' and pg.input_value('#op-title') == 'Nosso Grande Dia' and pg.input_value('#op-initials') == 'JB' and pg.input_value('#op-hint') == 'Abrir agora')
    publish(pg)
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
    new_invite(pg, 'Jardim', wait=1800)
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
    pg.click('[role=dialog] [aria-label="Fechar"]'); pg.wait_for_timeout(300)
    ok('Foto: cancelar descarta as mudanças', 'sepia' not in phone_img_style(pg) and 'grayscale(1)' in phone_img_style(pg))
    pg.click('button:has-text("Editar foto")'); pg.wait_for_timeout(500)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok('Foto: Esc fecha o editor', count(pg, '[data-testid="pe-frame"]') == 0)
    pg.select_option('#foto-format', '1:1'); pg.wait_for_timeout(200)
    ok('Foto: formato quadrado', 'aspect-ratio: 1' in (pg.locator('[data-canvas] [data-bid] >> nth=0').locator('[data-photo-frame] > div').first.get_attribute('style') or ''))
    # fundo da página
    page_sec(pg); pg.set_input_files('#bg-file', FIX + 'paisagem.jpg'); pg.wait_for_timeout(1200)
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
    page_sec(pg)
    ok('Recarregar: fundo e véu salvos', 'sepia(0.8)' in bgst and pg.input_value('#bg-dim') == '60', bgst)
    pg.click('aside li >> nth=1'); pg.wait_for_timeout(300)
    ok('Fundo: aplicado às outras páginas', count(pg, 'main [data-testid="page-bg"] img') == 1)
    pg.click('button:has-text("Remover fundo")'); pg.wait_for_timeout(200)
    ok('Fundo: remover', count(pg, 'main [data-testid="page-bg"]') == 0)
    publish(pg)
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
    new_invite(pg, 'Jardim', wait=2000)
    wait_saved(pg)
    did = pg.url.split('#/Editor/')[1]
    state['dnd'] = did
    order0 = ovl(pg)
    ok('Arrastar: prévia do editor mostra todos os blocos', order0 == ['c1', 'c2', 'c3', 'c4', 'c5'], order0)
    pg.wait_for_timeout(800)
    pg.locator('[data-ovl="c2"]').click(); pg.wait_for_timeout(200)
    ok('Posição exata fica recolhida (avançado)', count(pg, '#pos-x') == 0 and count(pg, '[data-testid="adv-toggle"]') == 1)
    adv(pg)
    ok('Posição livre é o padrão: blocos já têm posição', pg.input_value('#pos-x') != '' and count(pg, '[data-testid="check"]') == 0)
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
    adv(pg)
    ok('Recarregar: posições salvas', pg.input_value('#pos-y') == '560' and int(pg.input_value('#pos-w')) == wv, (pg.input_value('#pos-y'), pg.input_value('#pos-w')))
    # convidado vê as mesmas posições
    publish(pg)
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
    th = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json()).then(i => i.theme)", state['dnd'])
    link = BASE + '#/c/' + state['dnd'] + '?t=' + '.'.join(c.lstrip('#').upper() for c in [th['bg'], th['fg'], th['accent']])
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
    new_invite(pg, 'Jardim', wait=2000)
    wait_saved(pg)
    pid = pg.url.split('#/Editor/')[1]
    pg.fill('#inv-title', 'Casamento Personalizado')
    tab(pg, 'Evento'); pg.wait_for_timeout(200)
    ok('Personalização: desligada por padrão', not pg.is_checked('#pers-on'))
    pg.check('#pers-on'); pg.wait_for_timeout(200)
    pg.fill('#pers-greeting', 'Querida {nome}, você recebeu um convite'); pg.press('#pers-greeting', 'Tab')
    shot(pg, 'p1_editor')
    wait_saved(pg)
    pg.click('button:has-text("Criar convites individuais")'); pg.wait_for_timeout(1500)
    ok('Personalização: abre a tela de convidados', 'Respostas/' + pid in pg.url and pg.inner_text('h1') == 'Casamento Personalizado')
    ok('Convidados: criação fica num modal', count(pg, '[data-testid="novo-convite"]') == 0 and count(pg, '#g-name') == 0)
    pg.click('button:has-text("+ Adicionar convidados")'); pg.wait_for_timeout(200)
    ok('Convidados: botão abre o modal', count(pg, '[role=dialog][data-testid="novo-convite"] #g-name') == 1)
    ok('Convidados: modal "Adicionar convidados"', pg.inner_text('#add-title') == 'Adicionar convidados')
    pg.fill('#g-name', 'Família Silva'); pg.fill('#g-people', 'João Silva\nMaria Silva'); pg.fill('#g-comp', '1')
    ok('Convidados: mostra o total de pessoas', 'Até 3 pessoas' in text(pg))
    shot(pg, 'p2_modal_um')
    pg.click('[data-testid="novo-convite"] button:has-text("Salvar")'); pg.wait_for_timeout(800)
    ok('Convidados: convite criado (modal continua aberto para o próximo)', count(pg, 'li[data-guest]') == 1 and 'Família Silva' in text(pg) and count(pg, '[data-testid="novo-convite"]') == 1 and pg.input_value('#g-name') == '')
    ok('Convidados: X no canto e ações no rodapé', count(pg, '[data-testid="novo-convite"] > button[aria-label="Fechar"]') == 1 and pg.evaluate("""() => { const d = document.querySelector('[data-testid=novo-convite]').getBoundingClientRect(); const s = [...document.querySelectorAll('[data-testid=novo-convite] button')].find(b => b.textContent.trim() === 'Salvar').getBoundingClientRect(); const x = document.querySelector('[data-testid=novo-convite] [aria-label=Fechar]').getBoundingClientRect(); return d.right - s.right < 40 && d.bottom - s.bottom < 40 && d.right - x.right < 30 && x.top - d.top < 30; }"""))
    pg.click('button:has-text("Adicionar vários")')
    pg.fill('#g-bulk', 'Carlos Souza +1\nTios: Ana Lima, Beto Lima\n\n')
    shot(pg, 'p2_modal_varios')
    pg.click('[data-testid="novo-convite"] button:has-text("Salvar")'); pg.wait_for_timeout(800)
    ok('Convidados: vários de uma vez (fecha o modal)', count(pg, 'li[data-guest]') == 3 and 'Tios' in text(pg) and 'Carlos Souza' in text(pg) and count(pg, '[data-testid="novo-convite"]') == 0)
    pg.click('button:has-text("+ Adicionar convidados")'); pg.wait_for_timeout(200)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok('Convidados: Esc fecha o modal', count(pg, '[data-testid="novo-convite"]') == 0)
    pg.click('button:has-text("+ Adicionar convidados")'); pg.wait_for_timeout(200)
    pg.click('[data-testid="novo-convite"] [aria-label="Fechar"]'); pg.wait_for_timeout(200)
    ok('Convidados: X fecha o modal', count(pg, '[data-testid="novo-convite"]') == 0)
    shot(pg, 'p2_convidados')
    # editar o limite do Carlos
    pg.click('[aria-label="Editar Carlos Souza"]'); pg.wait_for_timeout(200)
    pg.locator('li[data-guest] input[type=number]').first.fill('2'); pg.click('button:has-text("Salvar")'); pg.wait_for_timeout(600)
    rc = pg.inner_text('li[data-guest]:has-text("Carlos Souza")')
    ok('Convidados: editar acompanhantes', '3\n1 convidado\n2 acompanhantes' in rc and 'Responder' in rc and 'Ver pessoas (1)' in rc, rc)
    silva = pg.get_attribute('li[data-guest]:has-text("Família Silva")', 'data-guest')
    tios = pg.get_attribute('li[data-guest]:has-text("Tios")', 'data-guest')
    # publicar
    go(pg, 'Editor/' + pid, 1800)
    publish(pg)
    # convidado: Família Silva
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + pid + '/' + silva); g.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000); g.wait_for_timeout(500)
    dest = g.inner_text('[data-testid="destinatario"]') if count(g, '[data-testid="destinatario"]') else ''
    ok('Abertura individual: nome escrito no próprio convite', 'Família Silva' in dest and 'Querida' in dest.title(), dest)
    ok('Abertura individual: faixa do topo sem o nome', 'Família Silva'.upper() not in g.inner_text('[data-dc="Abertura"] span[style*="text-transform: uppercase"][style*="pointer-events: none"]').upper() if count(g, '[data-dc="Abertura"] span[style*="pointer-events: none"][style*="text-transform: uppercase"]') else True)
    ok('Abertura individual: nome na fonte do tema', 'Cormorant' in g.evaluate("getComputedStyle(document.querySelector('[data-testid=destinatario] span:nth-child(2)')).fontFamily"))
    shot(g, 'p3_abertura')
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2600)
    go_rsvp(g); g.wait_for_timeout(500)
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
    go_rsvp(g); g.wait_for_timeout(400)
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
    go_rsvp(g2); g2.wait_for_timeout(400)
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
    go_rsvp(g); g.wait_for_timeout(400)
    tp = g.locator('[data-testid="rsvp-people"] [data-person]')
    tp.nth(0).locator('button:has-text("Vai")').first.click(); g.wait_for_timeout(150)
    ok('RSVP individual: Tios tem 2 pessoas e nenhum acompanhante', tp.count() == 2 and count(g, '[data-testid="add-extra"]') == 0)
    tp.nth(1).locator('button:has-text("Não vai")').click()
    g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(900)
    ok('RSVP individual: Tios confirma só Ana', 'Reservamos 1 lugar: Ana Lima. Não vai: Beto Lima.' in text(g), text(g)[-200:])
    ctx.close()
    # link geral bloqueado quando a opção estiver desmarcada
    go(pg, 'Editor/' + pid, 1800)
    tab(pg, 'Evento'); pg.wait_for_timeout(200)
    pg.uncheck('#pers-generic'); wait_saved(pg)
    gg = browser.new_context(viewport={'width': 390, 'height': 844}).new_page()
    gg.goto(BASE + '#/c/' + pid); gg.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000)
    gg.click('[aria-label="Toque para abrir o convite"]'); gg.wait_for_timeout(2600)
    go_rsvp(gg); gg.wait_for_timeout(400)
    ok('Link geral: pede o link individual', 'use o link do convite individual' in text(gg))
    gg.context.close()
    # painel e respostas
    go(pg, 'Convidados/' + pid, 1500)
    ok('Endereço antigo da tela de convidados abre a tela unificada', pg.inner_text('h1') == 'Casamento Personalizado' and count(pg, 'button[role=tab][aria-selected="true"]:has-text("Convidados")') == 1)
    stats = pg.inner_text('main')
    ok('Indicadores: pessoas que vão (convidados + acompanhantes), quem não vai e convites sem resposta', '3 convidados + 0 acompanhantes · 1 pessoa não vai' in stats and '1 sem resposta' in stats and 'de 3 convites' in stats, stats[:400])
    fs = 'li[data-guest]:has-text("Família Silva")'
    ok('Convidados: pessoas escondidas por padrão', count(pg, fs + ' .chip') == 0 and count(pg, '.lhead span:text-is("Pessoas")') == 0)
    pg.click('[aria-label="Ver pessoas de Família Silva"]'); pg.wait_for_timeout(200)
    pg.click('[aria-label="Ver pessoas de Tios"]'); pg.wait_for_timeout(200)
    row = pg.inner_text(fs)
    ok('Convidados: situação e nomes confirmados', 'Vão' in row and '2/3' in row and count(pg, fs + ' .chip[title="João Silva · vai"]') == 1 and count(pg, fs + ' .chip[title="Maria Silva · vai"]') == 1, row)
    ok('Convidados: coluna de cadastrados', '3\n2 convidados\n1 acompanhante' in row, row)
    ok('Convidados: botão ocultar pessoas', 'Ocultar pessoas' in row)
    ok('Convidados: lista sem subtítulo de tipo', 'Convite individual' not in row and 'Até ' not in row)
    boxes = [b['y'] for b in [pg.locator(fs + ' .chip').nth(i).bounding_box() for i in range(pg.locator(fs + ' .chip').count())]]
    ok('Convidados: nomes na vertical', len(boxes) == 2 and boxes[1] > boxes[0] + 10, boxes)
    row2 = pg.inner_text('li[data-guest]:has-text("Tios")')
    tl = 'li[data-guest]:has-text("Tios")'
    ok('Convidados: mostra quem não vai', count(pg, tl + ' .chip[title="Ana Lima · vai"]') == 1 and count(pg, tl + ' .chip[title="Beto Lima · não vai"]') == 1 and '1/' in row2, row2)
    shot(pg, 'p2_lista')
    if os.environ.get('SHOTS'):
        pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(300); shot(pg, 'p2_lista_celular'); pg.set_viewport_size({'width': 1280, 'height': 900})
    # o organizador registra a resposta de um convite individual pendente
    go(pg, 'Respostas/' + pid, 1500)
    ok('Convidados: botão Responder', count(pg, 'li[data-guest]:has-text("Carlos Souza") button:text-is("Responder")') == 1)
    pg.click('[aria-label="Responder por Carlos Souza"]'); pg.wait_for_timeout(200)
    fa = 'form[data-answer]'
    ok('Painel: mesma lista de pessoas do convite', count(pg, fa + ' [data-person]') == 1 and count(pg, fa + ' [data-testid="add-extra"]') == 1)
    pg.click(fa + ' button:has-text("Salvar resposta")'); pg.wait_for_timeout(300)
    ok('Painel: exige Vai/Não vai por pessoa', 'para cada pessoa' in pg.inner_text(fa))
    pg.click(fa + ' [data-person] button.seg:has-text("Vai")')
    pg.click(fa + ' [data-testid="add-extra"]'); pg.locator(fa + ' [data-extra] input').nth(0).fill('Lia Souza')
    pg.click(fa + ' [data-testid="add-extra"]'); pg.locator(fa + ' [data-extra] input').nth(1).fill('Rui Souza')
    ok('Painel: limite de acompanhantes do convite', count(pg, fa + ' [data-testid="add-extra"]') == 0)
    pg.fill(fa + ' input[placeholder="Ex.: vegetariano"]', 'sem glúten')
    pg.click(fa + ' button:has-text("Salvar resposta")'); pg.wait_for_timeout(700)
    rowc = pg.inner_text('li[data-guest]:has-text("Carlos Souza")')
    cs = 'li[data-guest]:has-text("Carlos Souza")'
    pg.click('[aria-label="Ver pessoas de Carlos Souza"]'); pg.wait_for_timeout(200); rowc = pg.inner_text(cs)
    ok('Painel: resposta individual registrada', count(pg, cs + ' .chip[title="Carlos Souza · vai"]') == 1 and count(pg, cs + ' .chip[title="Lia Souza · acompanhante"]') == 1 and count(pg, cs + ' .chip[title="Rui Souza · acompanhante"]') == 1 and '3/3' in rowc and 'sem glúten' in rowc and 'registrada por você' in rowc, rowc)
    cg = pg.get_attribute('li[data-guest]:has-text("Carlos Souza")', 'data-guest')
    gc = browser.new_context(viewport={'width': 390, 'height': 844}).new_page()
    gc.goto(BASE + '#/c/' + pid + '/' + cg); gc.wait_for_selector('[aria-label="Toque para abrir o convite"]', timeout=8000)
    gc.click('[aria-label="Toque para abrir o convite"]'); gc.wait_for_timeout(2600)
    go_rsvp(gc); gc.wait_for_timeout(400)
    ok('Convidado vê a resposta registrada pelo organizador', 'Carlos Souza, Lia Souza e Rui Souza' in text(gc))
    gc.context.close()
    pg.click('[aria-label="Editar resposta de Carlos Souza"]'); pg.wait_for_timeout(200)
    pg.click('form[data-answer] button:has-text("Apagar resposta")'); pg.wait_for_timeout(600)
    ok('Painel: apagar resposta volta a pendente', 'Pendente' in pg.inner_text('li[data-guest]:has-text("Carlos Souza")'))
    # excluir convite individual
    pg.click('[aria-label="Excluir Carlos Souza"]'); pg.click('button:has-text("Excluir convite e resposta")'); pg.wait_for_timeout(600)
    ok('Convidados: excluir', count(pg, 'li[data-guest]') == 2)


def t_robust(pg, browser):
    """Correções da bateria de 21/10: API robusta, prazo, limites, planilha, nomes longos, editor."""
    go(pg, 'Main', 900)
    J = "{method: m, headers: {'content-type': 'application/json'}, body: b}"
    call = "async ([m, u, b]) => { const r = await fetch(u, " + J + "); let d = null; try { d = await r.json(); } catch (e) {} return [r.status, d]; }"
    st, _ = pg.evaluate(call, ['POST', '/api/auth?action=login', 'null'])
    ok('API: corpo null no login não dá erro interno', st == 400, st)
    st, _ = pg.evaluate(call, ['POST', '/api/invites', '[1,2]'])
    ok('API: lista no lugar de objeto é recusada', st == 400, st)
    st, _ = pg.evaluate(call, ['PUT', '/api/invites?id=naoexiste', '{"title":"x"}'])
    ok('API: salvar convite excluído não o recria', st == 404, st)
    st, _ = pg.evaluate(call, ['POST', '/api/themes', 'null'])
    ok('API: tema sem cores é recusado', st == 400, st)
    body = '{"title":"Prazo vencido","status":"publicado","pages":[{"id":"p1","name":"Capa","blocks":[{"id":"r1","type":"rsvp","deadline":"2020-01-01T23:59:00.000Z","maxGuests":1},{"id":"b1","type":"botao","text":"Site","action":"link","dest":"www.exemplo.com.br"}]}]}'
    st, inv = pg.evaluate(call, ['POST', '/api/invites', body])
    iid = inv['id']
    ctx = browser.new_context(); g = ctx.new_page()
    g.goto(BASE + '#/c/' + iid); g.wait_for_timeout(1500)
    st, d = g.evaluate(call, ['POST', '/api/rsvp?invite=' + iid, '{"name":"Atrasado","go":true}'])
    ok('API: prazo vencido recusa resposta do convidado', st == 403 and 'prazo' in d['error'], [st, d])
    st, _ = pg.evaluate(call, ['POST', '/api/rsvp?invite=' + iid, '{"name":"Pelo painel","go":true,"via":"painel"}'])
    ok('API: organizador ainda registra resposta após o prazo', st == 200, st)
    pg.evaluate(call, ['PUT', '/api/invites?id=' + iid, body.replace('"deadline":"2020-01-01T23:59:00.000Z",', '')])
    st, d = g.evaluate(call, ['POST', '/api/rsvp?invite=' + iid, '{"name":"Excesso","go":true,"guests":9}'])
    ok('API: acompanhantes limitados ao máximo do bloco', st == 200 and d['entry']['guests'] == 1, d)
    # botão com link sem https://
    g.goto(BASE + '#/c/' + iid); g.wait_for_timeout(1200)
    if g.locator('[aria-label="Toque para abrir o convite"]').count():
        g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(2600)
    g.evaluate("() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; }")
    g.click('button:has-text("Site")'); g.wait_for_timeout(200)
    opened = g.evaluate('window.__opened')
    ok('Botão de link aceita endereço sem https://', opened == ['https://www.exemplo.com.br'], opened)
    ctx.close()
    # planilha: textos que viram fórmula entram como texto
    pg.evaluate(call, ['POST', '/api/rsvp?invite=' + iid, '{"name":"=HYPERLINK(1)","go":false,"via":"painel"}'])
    go(pg, 'Respostas/' + iid, 1300)
    with pg.expect_download() as dl:
        pg.click('button:has-text("Baixar planilha")')
    csv = open(dl.value.path(), encoding='utf-8-sig').read()
    ok('Planilha: fórmula vira texto', '"\'=HYPERLINK(1)"' in csv, csv[:300])
    # modal: frase no singular
    pg.evaluate(call, ['PUT', '/api/invites?id=' + iid, body.replace('"pages"', '"personal":{"enabled":true,"generic":true},"pages"')])
    go(pg, 'Respostas/' + iid, 1300)
    pg.click('button:has-text("+ Adicionar convidados")'); pg.wait_for_timeout(200)
    ok('Modal: frase no singular', 'Só 1 pessoa poderá confirmar' in text(pg))
    pg.keyboard.press('Escape')
    # nome longo cabe no convite fechado
    gid = pg.evaluate("(id) => fetch('/api/guests?invite=' + id, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({name: 'Família Albuquerque de Vasconcelos e Silva Pereira dos Santos'})}).then(r => r.json()).then(d => d[0].id)", iid)
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/%s/%s' % (iid, gid)); g.wait_for_selector('[data-testid="destinatario"]'); g.wait_for_timeout(600)
    fit = g.evaluate("() => { const d = document.querySelector('[data-testid=destinatario]'); const box = d.parentElement.getBoundingClientRect(); const r = d.getBoundingClientRect(); return r.bottom <= box.bottom + 1 && r.top >= box.top - 1; }")
    ok('Nome longo cabe no envelope', fit)
    ctx.close()
    # editor: convite excluído em outra aba
    go(pg, 'Editor/' + iid, 1800)
    pg.evaluate("(id) => fetch('/api/invites?id=' + id, {method: 'DELETE'})", iid)
    tab(pg, 'Evento'); pg.wait_for_timeout(200)
    pg.locator('input.fld').first.fill('Outro título'); pg.wait_for_timeout(1800)
    ok('Editor: avisa que o convite foi excluído (sem tentar de novo)', 'este convite foi excluído' in text(pg))


def login_as(browser, user, pw, vp=None):
    ctx = browser.new_context(viewport=vp or {'width': 1280, 'height': 900})
    p = ctx.new_page(); p.set_default_timeout(6000)
    p.on('pageerror', lambda e: errors.append('[%s] %s' % (user, e)))
    go(p, 'Main', 900)
    p.fill('#user', user); p.fill('#pw', pw); p.click('button:has-text("Entrar")'); p.wait_for_timeout(1100)
    return p


def t_users(pg, browser):
    """Painel de administração: usuários, perfis e permissões."""
    J = "async ([m, u, b]) => { const r = await fetch(u, {method: m, headers: {'content-type': 'application/json'}, body: b}); let d = null; try { d = await r.json(); } catch (e) {} return [r.status, d]; }"
    go(pg, 'Usuarios', 1300)
    ok('Usuários: painel abre com a conta principal', 'Usuários' in pg.inner_text('h1') and count(pg, 'li[data-user="admin"]') == 1 and 'Conta principal' in pg.inner_text('li[data-user="admin"]'))
    ok('Usuários: conta principal sem ações', count(pg, 'li[data-user="admin"] button') == 0)
    # novo usuário (perfil Usuário)
    pg.click('button:has-text("+ Novo usuário")'); pg.wait_for_timeout(200)
    ok('Usuários: modal de cadastro com os campos', all(count(pg, '#u-' + f) == 1 for f in ['name', 'email', 'phone', 'username', 'pass', 'active']))
    pg.click('[data-testid="gen-pass"]'); pg.wait_for_timeout(150)
    gp = pg.input_value('#u-pass')
    ok('Usuários: gerar senha segura preenche e mostra a senha', len(gp) == 12 and any(c.isdigit() for c in gp) and pg.get_attribute('#u-pass', 'type') == 'text', gp)
    pg.click('[data-testid="usuario-modal"] button[aria-label="Ocultar senha"]'); pg.fill('#u-pass', '')
    pg.fill('#u-name', 'Maria Teste')
    ok('Usuários: nome de usuário sugerido pelo nome', pg.input_value('#u-username') == 'maria.teste', pg.input_value('#u-username'))
    pg.fill('#u-email', 'maria@exemplo.com'); pg.fill('#u-phone', '(16) 99999-0000'); pg.fill('#u-pass', '123')
    pg.click('[data-testid="usuario-modal"] button[aria-label="Mostrar senha"]')
    ok('Usuários: olho mostra a senha no cadastro', pg.get_attribute('#u-pass', 'type') == 'text' and pg.input_value('#u-pass') == '123')
    pg.click('[data-testid="usuario-modal"] button[aria-label="Ocultar senha"]')
    ok('Usuários: olho esconde a senha no cadastro', pg.get_attribute('#u-pass', 'type') == 'password')
    pg.click('[data-testid="usuario-modal"] button:has-text("Salvar")'); pg.wait_for_timeout(300)
    ok('Usuários: senha curta recusada', '8 caracteres' in pg.inner_text('[data-testid="usuario-modal"]'))
    pg.fill('#u-pass', 'senhaMaria1'); pg.click('[data-testid="usuario-modal"] button:has-text("Salvar")'); pg.wait_for_timeout(800)
    row = pg.inner_text('li[data-user="maria.teste"]') if count(pg, 'li[data-user="maria.teste"]') else ''
    ok('Usuários: usuário criado na lista', 'Maria Teste' in row and 'maria@exemplo.com' in row and 'Usuário' in row and 'Ativo' in row, row)
    # duplicado
    pg.click('button:has-text("+ Novo usuário")'); pg.wait_for_timeout(200)
    pg.fill('#u-name', 'Outra Maria'); pg.fill('#u-email', 'maria@exemplo.com'); pg.fill('#u-username', 'outra'); pg.fill('#u-pass', 'senhaOutra1')
    pg.click('[data-testid="usuario-modal"] button:has-text("Salvar")'); pg.wait_for_timeout(600)
    ok('Usuários: e-mail repetido recusado', 'Já existe um usuário com esse e-mail' in pg.inner_text('[data-testid="usuario-modal"]'))
    pg.click('[data-testid="usuario-modal"] [aria-label="Fechar"]'); pg.wait_for_timeout(200)
    # novo administrador
    pg.click('button:has-text("+ Novo usuário")'); pg.wait_for_timeout(200)
    pg.fill('#u-name', 'Bruno Admin'); pg.fill('#u-email', 'bruno@exemplo.com'); pg.fill('#u-pass', 'senhaBruno1')
    pg.click('[data-testid="usuario-modal"] button[role=radio]:has-text("Administrador")')
    pg.click('[data-testid="usuario-modal"] button:has-text("Salvar")'); pg.wait_for_timeout(800)
    ok('Usuários: administrador criado', 'Administrador' in pg.inner_text('li[data-user="bruno.admin"]'))
    pg.screenshot(path=os.environ['SHOTS'] + '/usuarios.png', full_page=True) if os.environ.get('SHOTS') else None

    # Maria (perfil Usuário)
    mp = login_as(browser, 'maria.teste', 'senhaMaria1')
    ok('Usuário: entra e vê "Meus convites" sem convites de outros', count(mp, 'article[data-invite]') == 0, text(mp)[:300])
    ok('Usuário: sem acesso ao menu Usuários', count(mp, 'nav a:has-text("Usuários")') == 0)
    go(mp, 'Usuarios', 1000)
    ok('Usuário: endereço do painel de administração volta para os convites', count(mp, 'h1:has-text("Olá, Maria")') == 1, text(mp)[:200])
    st, _ = mp.evaluate(J, ['GET', '/api/users', None])
    ok('Usuário: API de usuários recusada', st == 403, st)
    admin_ids = [i['id'] for i in pg.evaluate("fetch('/api/invites').then(r => r.json())")]
    st, _ = mp.evaluate(J, ['PUT', '/api/invites?id=' + admin_ids[0], '{"title":"invadido"}'])
    ok('Usuário: não altera convite de outro', st == 404, st)
    st, _ = mp.evaluate(J, ['GET', '/api/guests?invite=' + admin_ids[0], None])
    ok('Usuário: não vê convidados de outro', st == 404, st)
    st, _ = mp.evaluate(J, ['DELETE', '/api/invites?id=' + admin_ids[0], None])
    ok('Usuário: não exclui convite de outro', st == 404, st)
    pg.evaluate(J, ['POST', '/api/themes', '{"name":"Tema do Admin","bg":"#111111","fg":"#EEEEEE","accent":"#C9A227"}'])
    themes = mp.evaluate("fetch('/api/themes').then(r => r.json())")
    tid = [t['id'] for t in themes if t['name'] == 'Tema do Admin']
    st, _ = mp.evaluate(J, ['DELETE', '/api/themes?id=' + (tid[0] if tid else 'x'), None])
    ok('Usuário: não exclui tema de outro', st == 403, st)
    ok('Usuário: vê todos os temas, sem poder editar os de outros', len(themes) >= 1 and all(t.get('canEdit') is False for t in themes), [(t['name'], t.get('canEdit')) for t in themes])
    # Maria cria um convite pela galeria de temas
    go(mp, 'Temas', 1200)
    new_invite(mp, 'Jardim', wait=2200)
    mid = mp.url.split('#/Editor/')[1] if '#/Editor/' in mp.url else ''
    ok('Usuário: cria o próprio convite', bool(mid), mp.url)
    go(mp, 'Main', 1200)
    ok('Usuário: vê o próprio convite', count(mp, 'article[data-invite]') == 1)
    st, d = mp.evaluate(J, ['POST', '/api/guests?invite=' + mid, '{"name":"Família da Maria"}'])
    ok('Usuário: cria convidados no próprio convite', st == 201, [st, d])
    go(mp, 'Respostas/' + admin_ids[0], 1300)
    ok('Usuário: lista de convidados só mostra os próprios convites', all(o != admin_ids[0] for o in mp.eval_on_selector_all('select option', 'els => els.map(e => e.value)')))
    # administrador vê o convite da Maria com o dono
    go(pg, 'Main', 1300)
    ok('Administrador: vê convites de todos com o nome do dono', count(pg, '[data-owner="Maria Teste"]') == 1)
    st, _ = pg.evaluate(J, ['GET', '/api/guests?invite=' + mid, None])
    ok('Administrador: vê convidados de qualquer convite', st == 200, st)
    # inativar derruba a sessão
    go(pg, 'Usuarios', 1300)
    pg.click('[aria-label="Inativar Maria Teste"]'); pg.wait_for_timeout(700)
    ok('Usuários: inativar', 'Inativo' in pg.inner_text('li[data-user="maria.teste"]'))
    go(mp, 'Main', 1200)
    ok('Usuário inativado perde o acesso na hora', count(mp, '#pw') == 1)
    mp.fill('#user', 'maria.teste'); mp.fill('#pw', 'senhaMaria1'); mp.click('button:has-text("Entrar")'); mp.wait_for_timeout(1000)
    ok('Usuário inativo não consegue entrar', 'inativo' in text(mp))
    pg.click('[aria-label="Ativar Maria Teste"]'); pg.wait_for_timeout(700)
    # editar: nova senha
    pg.click('[aria-label="Editar Maria Teste"]'); pg.wait_for_timeout(200)
    ok('Usuários: edição traz os dados', pg.input_value('#u-email') == 'maria@exemplo.com' and pg.input_value('#u-pass') == '')
    ok('Usuários: senha volta escondida ao abrir a edição', pg.get_attribute('#u-pass', 'type') == 'password')
    pg.fill('#u-pass', 'novaSenha99'); pg.click('[data-testid="usuario-modal"] button:has-text("Salvar")'); pg.wait_for_timeout(800)
    mp.fill('#user', 'maria@exemplo.com'); mp.fill('#pw', 'senhaMaria1'); mp.click('button:has-text("Entrar")'); mp.wait_for_timeout(1000)
    ok('Senha antiga deixa de valer', 'incorretos' in text(mp))
    mp.fill('#pw', 'novaSenha99'); mp.click('button:has-text("Entrar")'); mp.wait_for_timeout(1100)
    ok('Entra com e-mail e a nova senha', count(mp, 'h1:has-text("Olá, Maria")') == 1)
    mp.context.close()
    # administrador criado entra e acessa o painel; não pode se inativar
    bp = login_as(browser, 'bruno.admin', 'senhaBruno1')
    ok('Novo administrador vê todos os convites e o painel', 'Todos os convites' in text(bp) and count(bp, 'nav a:has-text("Usuários")') == 1)
    st, d = bp.evaluate(J, ['PUT', '/api/users?id=' + bp.evaluate("fetch('/api/auth?action=me').then(r => r.json()).then(d => d.user.id)"), '{"active":false}'])
    ok('Administrador não pode inativar a própria conta', st == 400, [st, d])
    bp.context.close()


def t_security(pg, browser):
    """Ataques comuns: CSRF, força bruta, ids inválidos, recriar convite alheio, cores injetadas, SVG, cabeçalhos."""
    import urllib.request, urllib.error, json as _json
    J = "async ([m, u, b]) => { const r = await fetch(u, {method: m, headers: {'content-type': 'application/json'}, body: b}); let d = null; try { d = await r.json(); } catch (e) {} return [r.status, d]; }"
    def raw(method, path, body=None, headers=None):
        req = urllib.request.Request(BASE.rstrip('/') + path, data=(body.encode() if body else None), method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, dict(r.headers), r.read().decode('utf-8', 'ignore')
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read().decode('utf-8', 'ignore')
    go(pg, 'Main', 900)
    cookie = '; '.join(c['name'] + '=' + c['value'] for c in pg.context.cookies())
    # CSRF: outro site tentando alterar dados com o cookie do organizador
    st, _, _ = raw('POST', '/api/invites', '{"title":"csrf"}', {'Cookie': cookie, 'Content-Type': 'text/plain', 'Origin': 'https://site-malicioso.example'})
    ok('Segurança: requisição de outro site (Origin) recusada', st == 403, st)
    st, _, _ = raw('POST', '/api/invites', '{"title":"csrf"}', {'Cookie': cookie, 'Content-Type': 'text/plain', 'Sec-Fetch-Site': 'cross-site'})
    ok('Segurança: requisição de outro site (Sec-Fetch-Site) recusada', st == 403, st)
    # cabeçalhos de segurança
    st, h, _ = raw('GET', '/')
    hl = {k.lower(): v for k, v in h.items()}
    ok('Segurança: cabeçalhos (CSP, frame, nosniff, referrer)', "frame-ancestors 'none'" in hl.get('content-security-policy', '') and hl.get('x-frame-options') == 'DENY' and hl.get('x-content-type-options') == 'nosniff' and 'strict-origin' in hl.get('referrer-policy', ''), hl)
    ck = [c for c in pg.context.cookies() if c['name'] == 'ci_session']
    ok('Segurança: cookie de sessão HttpOnly e SameSite', ck and ck[0]['httpOnly'] and ck[0]['sameSite'] in ('Lax', 'Strict'), ck)
    # ids inválidos
    st, _ = pg.evaluate(J, ['GET', '/api/invites?id=../../x', None])
    ok('Segurança: id inválido recusado', st == 400, st)
    st, _ = pg.evaluate(J, ['GET', '/api/guests?invite=a%20b', None])
    ok('Segurança: id de convite inválido recusado', st == 400, st)
    # tema com "cor" que injeta CSS
    st, _ = pg.evaluate(J, ['POST', '/api/themes', _json.dumps({'name': 'x', 'bg': 'red;background:url(https://x.example/a)', 'fg': '#000000', 'accent': '#111111'})])
    ok('Segurança: cor inválida no tema recusada', st == 400, st)
    # senha fraca
    st, d = pg.evaluate(J, ['POST', '/api/users', _json.dumps({'name': 'Fraca', 'email': 'fraca@exemplo.com', 'username': 'fraca', 'password': '12345678'})])
    ok('Segurança: senha comum recusada', st == 400 and 'fácil' in d['error'], [st, d])
    # dois usuários comuns: B não pode recriar (via "Desfazer") o convite excluído de A
    for nm, un in [('Ana Seg', 'ana.seg'), ('Beto Seg', 'beto.seg')]:
        pg.evaluate(J, ['POST', '/api/users', _json.dumps({'name': nm, 'email': un + '@exemplo.com', 'username': un, 'password': 'Segura#2026'})])
    ap = login_as(browser, 'ana.seg', 'Segura#2026')
    st, inv = ap.evaluate(J, ['POST', '/api/invites', '{"title":"Convite da Ana","status":"publicado"}'])
    st, deleted = ap.evaluate(J, ['DELETE', '/api/invites?id=' + inv['id'], None])
    bp = login_as(browser, 'beto.seg', 'Segura#2026')
    st, _ = bp.evaluate(J, ['PUT', '/api/invites?id=' + inv['id'], _json.dumps(dict(deleted['invite'], title='Sequestrado', __rsvps={}, __guests={}))])
    ok('Segurança: outro usuário não recria convite excluído', st == 404, st)
    st, _ = bp.evaluate(J, ['PUT', '/api/invites?id=idnovoqualquer', '{"title":"x","__rsvps":{}}'])
    ok('Segurança: "Desfazer" não cria convite com id inventado', st == 404, st)
    st, back = ap.evaluate(J, ['PUT', '/api/invites?id=' + inv['id'], _json.dumps(dict(deleted['invite'], __rsvps={}, __guests={}))])
    ok('Segurança: dono ainda desfaz a exclusão', st == 200 and back['title'] == 'Convite da Ana', st)
    # convite público não revela o dono
    st, _h, body = raw('GET', '/api/invites?id=' + inv['id'])
    ok('Segurança: convite público sem dados do dono', st == 200 and '"ownerId"' not in body, st)
    # força bruta: bloqueio depois de várias senhas erradas
    codes = [ap.evaluate(J, ['POST', '/api/auth?action=login', _json.dumps({'username': 'beto.seg', 'password': 'errada' + str(i)})])[0] for i in range(9)]
    st, d = ap.evaluate(J, ['POST', '/api/auth?action=login', _json.dumps({'username': 'beto.seg', 'password': 'Segura#2026'})])
    ok('Segurança: login bloqueado após muitas senhas erradas', codes[:8] == [401] * 8 and codes[8] == 429 and st == 429, [codes, st])
    st, d = ap.evaluate(J, ['POST', '/api/auth?action=login', _json.dumps({'username': 'naoexiste', 'password': 'qualquer1'})])
    ok('Segurança: usuário inexistente tem a mesma mensagem', st == 401 and d['error'] == 'Usuário ou senha incorretos.', d)
    # SVG (pode conter script) não é aceito no envio local
    st, _, _ = raw('POST', '/api/upload?name=a.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', {'Cookie': cookie, 'Content-Type': 'image/svg+xml'})
    ok('Segurança: envio de SVG recusado', st == 415, st)
    ap.context.close(); bp.context.close()


def t_media_limits(pg, browser):
    """Fotos reduzidas antes do envio; limites de tamanho de vídeo e música; lista de convites leve."""
    import tempfile, random
    from PIL import Image
    tmp = tempfile.mkdtemp()
    big = os.path.join(tmp, 'grande.jpg')
    im = Image.new('RGB', (4000, 3000))
    px = im.load()
    for y in range(0, 3000, 4):
        for x in range(0, 4000, 4):
            px[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    im.save(big, quality=95)
    vid = os.path.join(tmp, 'longo.mp4'); open(vid, 'wb').write(b'\0' * (21 * 1024 * 1024))
    mus = os.path.join(tmp, 'longa.mp3'); open(mus, 'wb').write(b'\0' * (11 * 1024 * 1024))
    go(pg, 'Temas', 1200)
    new_invite(pg, 'Jardim', wait=2200)
    iid = pg.url.split('#/Editor/')[1]
    pg.click('.blk >> nth=0'); pg.wait_for_timeout(150)
    pg.set_input_files('#media-file', big)
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando')", timeout=20000)
    pg.wait_for_timeout(500)
    src = pg.get_attribute('[data-canvas] [data-bid] img >> nth=0', 'src') or ''
    info = pg.evaluate("""async (u) => { const r = await fetch(u); const b = await r.blob(); const img = new Image(); img.src = URL.createObjectURL(b); await img.decode(); return [b.type, b.size, img.naturalWidth, img.naturalHeight]; }""", src)
    ok('Mídia: foto grande reduzida para 2000 px e WebP antes do envio', info[0] == 'image/webp' and max(info[2], info[3]) == 2000 and info[1] < os.path.getsize(big), [info, os.path.getsize(big)])
    # vídeo acima de 20 MB
    pg.click('aside button:has-text("Vídeo")') if count(pg, 'aside button:has-text("Vídeo")') else None
    pg.wait_for_timeout(300)
    if count(pg, '#media-file'):
        pg.set_input_files('#media-file', vid); pg.wait_for_timeout(700)
        ok('Mídia: vídeo acima de 20 MB recusado com explicação', 'o máximo é 20 MB' in text(pg), text(pg)[-400:])
    tab(pg, 'Música'); pg.wait_for_timeout(200)
    pg.set_input_files('#mus-file', mus); pg.wait_for_timeout(700)
    ok('Mídia: música acima de 10 MB recusada com explicação', 'o máximo é 10,0 MB' in text(pg) or 'o máximo é 10 MB' in text(pg), text(pg)[-400:])
    ok('Mídia: música recusada não fica no convite', count(pg, '[data-testid="mus-drop"]') == 1)
    lst = pg.evaluate("fetch('/api/invites').then(r => r.json())")
    ok('Lista de convites não traz contagem de respostas (menos leituras no banco)', lst and all('rsvp' not in i for i in lst))


def t_backup(pg, browser):
    """Cópias de segurança: fazer agora, listar, baixar, restaurar (com cópia de segurança antes), permissões e agendamento."""
    import json as _json, tempfile
    J = "async ([m, u, b]) => { const r = await fetch(u, {method: m, headers: {'content-type': 'application/json'}, body: b}); let d = null; try { d = await r.json(); } catch (e) {} return [r.status, d]; }"
    go(pg, 'Usuarios', 1500)
    ok('Backup: seção de cópias no painel de administração', count(pg, '[data-testid="backups"]') == 1 and 'Cópias de segurança' in text(pg))
    before = pg.evaluate("fetch('/api/invites').then(r => r.json()).then(l => l.length)")
    pg.click('button:has-text("Fazer cópia agora")'); pg.wait_for_timeout(1500)
    ok('Backup: cópia manual feita e listada', count(pg, 'li[data-backup]') == 1 and 'Cópia salva' in text(pg) and 'Última cópia' in text(pg), text(pg)[-500:])
    name = pg.get_attribute('li[data-backup] >> nth=0', 'data-backup')
    # baixar
    with pg.expect_download() as dl:
        pg.click('li[data-backup] a:has-text("Baixar")')
    data = _json.load(open(dl.value.path(), encoding='utf-8'))
    ok('Backup: arquivo baixado com os dados', data.get('app') == 'convite-interativo' and len(data['data']['invites']) == before and data['summary']['users'] >= 1, data.get('summary'))
    # muda os dados e restaura a cópia
    pg.evaluate(J, ['POST', '/api/invites', '{"title":"Criado depois da cópia"}'])
    pg.click('li[data-backup="%s"] button:has-text("Restaurar")' % name); pg.wait_for_timeout(200)
    ok('Backup: restaurar pede confirmação', count(pg, '[data-testid="restaurar-modal"]') == 1 and 'substituídos' in pg.inner_text('[data-testid="restaurar-modal"]'))
    pg.click('[data-testid="restaurar-modal"] button:has-text("Restaurar e substituir")'); pg.wait_for_timeout(2000)
    after = pg.evaluate("fetch('/api/invites').then(r => r.json()).then(l => l.map(i => i.title))")
    ok('Backup: restauração volta ao estado da cópia', len(after) == before and 'Criado depois da cópia' not in after, [before, len(after)])
    ok('Backup: cópia do estado anterior salva antes de restaurar', count(pg, 'li[data-backup*="antes-de-restaurar"]') == 1)
    # restaurar a partir de um arquivo
    pg.evaluate(J, ['POST', '/api/invites', '{"title":"Outro depois"}'])
    pg.set_input_files('#bk-file', dl.value.path()); pg.wait_for_timeout(400)
    ok('Backup: arquivo escolhido mostra o resumo antes de restaurar', count(pg, '[data-testid="restaurar-modal"]') == 1 and 'convites' in pg.inner_text('[data-testid="restaurar-modal"]'))
    pg.click('[data-testid="restaurar-modal"] button:has-text("Restaurar e substituir")'); pg.wait_for_timeout(2000)
    after = pg.evaluate("fetch('/api/invites').then(r => r.json()).then(l => l.map(i => i.title))")
    ok('Backup: restauração a partir de arquivo', len(after) == before and 'Outro depois' not in after, len(after))
    bad = os.path.join(tempfile.mkdtemp(), 'qualquer.json'); open(bad, 'w').write('{"x":1}')
    pg.set_input_files('#bk-file', bad); pg.wait_for_timeout(400)
    ok('Backup: arquivo que não é cópia é recusado', 'não é uma cópia de segurança' in text(pg) and count(pg, '[data-testid="restaurar-modal"]') == 0)
    # agendamento diário: sem CRON_SECRET, no máximo uma cópia a cada 20 h
    st, d = pg.evaluate(J, ['GET', '/api/backup?action=cron', None])
    ok('Backup: agendamento não repete cópia recente', st == 200 and d.get('skipped') is True, d)
    # permissões
    gp = browser.new_context().new_page(); gp.goto(BASE); gp.wait_for_timeout(400)
    st, _ = gp.evaluate(J, ['GET', '/api/backup', None])
    st2, _ = gp.evaluate(J, ['GET', '/api/backup?action=download&name=' + name, None])
    ok('Backup: sem login não lista nem baixa cópias', st == 401 and st2 == 401, [st, st2])
    gp.context.close()


def t_savedate(pg):
    """Tema Save the Date: capa pronta, moldura fina, fonte cursiva no título e serifada nos textos."""
    go(pg, 'Temas', 1300)
    ok('Save the Date: tema na galeria (Casamento, Moldura fina)', count(pg, '[aria-label="Tema Save the Date"]') == 1 and 'Moldura fina' in pg.inner_text('[aria-label="Tema Save the Date"]'))
    new_invite(pg, 'Save the Date', wait=2500)
    iid = pg.url.split('#/Editor/')[1]
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    cap = inv['pages'][0]
    ok('Save the Date: capa pronta com os textos do modelo', [b['text'] for b in cap['blocks']][:4] == ['Save the Date', 'NOME & NOME', '──────  ◆  ──────', 'DD . MM . AAAA'] and cap.get('free') is True, [b['text'] for b in cap['blocks']])
    ok('Save the Date: tema com moldura fina e textos em Cormorant', inv['theme']['layout'] == 'fina' and inv['theme']['bodyKey'] == 'cormorant' and inv['theme']['fontKey'] == 'greatvibes' and inv['kicker'] == 'Casamento', inv['theme'])
    page_sec(pg); pg.set_input_files('#bg-file', FIX + 'paisagem.jpg')
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando')", timeout=15000); pg.wait_for_timeout(1500)
    # foto do local no bloco de mapa
    pg.click('button.pg:has-text("Detalhes")'); pg.wait_for_timeout(200)
    pg.click('[aria-label^="Bloco Mapa"]'); pg.wait_for_timeout(200)
    ok('Mapa: campo para escolher a foto do local', count(pg, '#place-file') == 1)
    pg.set_input_files('#place-file', FIX + 'paisagem.jpg')
    pg.wait_for_function("() => !document.body.innerText.includes('Enviando')", timeout=15000); pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    mp = [b for p in inv['pages'] for b in p['blocks'] if b['type'] == 'mapa'][0]
    ok('Mapa: foto do local salva (sem endereço temporário)', mp.get('photoUrl', '').startswith(('http', '/')) and 'photoUploading' not in mp, mp)
    ok('Mapa: editor mostra Trocar e Remover foto', count(pg, '#place-file-swap') == 1 and count(pg, 'button:has-text("Remover foto")') == 1)
    ok('Mapa: prévia mostra a foto no lugar do ícone', count(pg, 'img[alt^="Foto de "]') >= 1)
    pg.click('button:has-text("Editar foto do local")'); pg.wait_for_timeout(700)
    ok('Mapa: editor de fotos abre com a foto do local', count(pg, '[role=dialog] [data-testid="pe-frame"] img') == 1 and 'Editar foto do local' in pg.inner_text('[role=dialog]') and count(pg, '#pe-format') == 0)
    set_range(pg, '#pe-zoom', 150)
    pg.click('button[role=tab]:has-text("Luz e cor")'); set_range(pg, '#pe-bri', 120)
    pg.click('button:has-text("Aplicar")'); pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    mp = [b for p in inv['pages'] for b in p['blocks'] if b['type'] == 'mapa'][0]
    pe = mp.get('photoEdit') or {}
    ok('Mapa: edição da foto do local salva (zoom e brilho)', pe.get('zoom') == 1.5 and pe.get('brightness') == 120 and 'frame' not in pe, pe)
    ok('Mapa: painel indica foto editada', 'Foto editada' in pg.inner_text('body'))
    # diminuir a foto (abaixo de 100%)
    pg.click('button:has-text("Editar foto do local")'); pg.wait_for_timeout(700)
    for _ in range(12): pg.click('[aria-label="Diminuir a foto"]')
    pg.wait_for_timeout(200)
    ok('Foto: botão − diminui até 50%', 'Tamanho da foto · 50%' in pg.inner_text('[role=dialog]'), pg.inner_text('[role=dialog]')[:200])
    fr = pg.locator('[data-testid="pe-frame"]').bounding_box(); im = pg.locator('[data-testid="pe-frame"] img').bounding_box()
    ok('Foto: com zoom abaixo de 100% a foto fica menor que o quadro', im['width'] < fr['width'] - 2 and im['height'] < fr['height'] + 1, (fr, im))
    x0 = im['x']
    pg.mouse.move(fr['x'] + fr['width'] / 2, fr['y'] + fr['height'] / 2); pg.mouse.down()
    pg.mouse.move(fr['x'] + fr['width'] / 2 + 80, fr['y'] + fr['height'] / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(150)
    im2 = pg.locator('[data-testid="pe-frame"] img').bounding_box()
    ok('Foto: foto reduzida acompanha o arraste dentro do quadro', im2['x'] > x0 + 5 and im2['x'] + im2['width'] <= fr['x'] + fr['width'] + 1, (x0, im2, fr))
    pg.click('[aria-label="Ampliar a foto"]'); pg.wait_for_timeout(150)
    ok('Foto: botão + amplia', 'Tamanho da foto · 60%' in pg.inner_text('[role=dialog]'))
    pg.click('button:has-text("Aplicar")'); pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    mp = [b for p in inv['pages'] for b in p['blocks'] if b['type'] == 'mapa'][0]
    ok('Foto: tamanho reduzido salvo', (mp.get('photoEdit') or {}).get('zoom') == 0.6, mp.get('photoEdit'))
    # altura do espaço da foto do local
    pg_det = [p for p in inv['pages'] if any(b['type'] == 'mapa' for b in p['blocks'])][0]
    below0 = {b['id']: b['pos']['y'] for b in pg_det['blocks'] if b.get('pos') and b['pos']['y'] > mp['pos']['y']} if mp.get('pos') else {}
    ok('Mapa: controle de altura do espaço da foto (padrão 120 px)', count(pg, '#place-h') == 1 and pg.input_value('#place-h') == '120', pg.input_value('#place-h') if count(pg, '#place-h') else None)
    pg.click('[aria-label="Alturas prontas"] button:has-text("Alta")'); pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    pg_det = [p for p in inv['pages'] if any(b['type'] == 'mapa' for b in p['blocks'])][0]
    mp = [b for b in pg_det['blocks'] if b['type'] == 'mapa'][0]
    w = mp['pos']['w'] if mp.get('pos') else 334
    ok('Mapa: altura "Alta" salva (180 px)', abs(w / mp.get('photoRatio', 0.0001) - 180) < 1.5, mp.get('photoRatio'))
    moved = all(abs(b['pos']['y'] - below0[b['id']] - 60) <= 1 for b in pg_det['blocks'] if b['id'] in below0)
    ok('Mapa: blocos abaixo descem junto com a foto', bool(below0) and moved, (below0, [(b['id'], b.get('pos')) for b in pg_det['blocks']]))
    set_range(pg, '#place-h', 150); pg.wait_for_timeout(300)
    pg.click('[aria-label="Diminuir a altura da foto"]'); pg.wait_for_timeout(1800)
    ok('Mapa: barra e botão − ajustam a altura', pg.input_value('#place-h') == '140', pg.input_value('#place-h'))
    pg.click('button:has-text("Editar foto do local")'); pg.wait_for_timeout(600)
    fr = pg.locator('[data-testid="pe-frame"]').bounding_box()
    ok('Mapa: editor de fotos usa a nova proporção do espaço', abs(fr['width'] / fr['height'] - w / 140) < 0.05, (fr, w))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # link do local (Instagram, site…)
    ok('Mapa: campo "Link do local"', count(pg, '#place-url') == 1)
    pg.fill('#place-url', 'espaco villa'); pg.press('#place-url', 'Tab'); pg.wait_for_timeout(300)
    ok('Mapa: link inválido mostra aviso', 'Não reconheci esse link' in pg.inner_text('aside[aria-label="Propriedades"]'))
    pg.fill('#place-url', '@espaco.villa'); pg.press('#place-url', 'Tab'); pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    mp = [b for p in inv['pages'] for b in p['blocks'] if b['type'] == 'mapa'][0]
    ok('Mapa: @perfil vira o link do Instagram e é salvo', mp.get('placeUrl') == 'https://instagram.com/espaco.villa' and pg.input_value('#place-url') == 'https://instagram.com/espaco.villa', mp.get('placeUrl'))
    ok('Mapa: confirmação do link no editor', 'Instagram' in (pg.inner_text('[data-testid="place-url-ok"]') if count(pg, '[data-testid="place-url-ok"]') else ''))
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    ok('Save the Date: foto de fundo da capa com véu de 40%', inv['pages'][0]['bg']['dim'] == 40 and inv['pages'][0]['bg']['url'], inv['pages'][0].get('bg'))
    inv['status'] = 'publicado'
    pg.evaluate("([id, inv]) => fetch('/api/invites?id=' + id, {method: 'PUT', headers: {'content-type': 'application/json'}, body: JSON.stringify(inv)})", [iid, inv])
    ctx = pg.context.browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    g.goto(BASE + '#/c/' + iid); g.wait_for_timeout(2000)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(3000)
    info = g.evaluate("""() => { const t = [...document.querySelectorAll('[data-bid]')].find(e => e.innerText.includes('NOME & NOME'));
      const frame = [...document.querySelectorAll('div[aria-hidden=true]')].find(d => getComputedStyle(d).borderTopWidth === '1px' && getComputedStyle(d).position === 'absolute');
      return [t ? getComputedStyle(t).fontFamily : '', !!frame, !!document.querySelector('[data-testid=page-bg]')]; }""")
    ok('Save the Date: convite com moldura fina, foto de fundo e nomes em Cormorant', 'Cormorant' in info[0] and info[1] and info[2], info)
    g.click('nav button:has-text("Detalhes")'); g.wait_for_timeout(1200)
    loaded = g.evaluate("() => { const i = document.querySelector('img[alt^=\"Foto de \"]'); return !!i && i.complete && i.naturalWidth > 0; }")
    ok('Mapa: convidado vê a foto do local carregada', loaded)
    st = g.evaluate("() => document.querySelector('img[alt^=\"Foto de \"]').getAttribute('style') || ''")
    bx = g.evaluate("() => { const i = document.querySelector('img[alt^=\"Foto de \"]').parentElement.getBoundingClientRect(); return [i.width, i.height]; }")
    ok('Mapa: convidado vê o espaço da foto com a altura escolhida', abs(bx[0] / bx[1] - w / 140) < 0.05, bx)
    ok('Mapa: convidado vê a foto do local com a edição', 'brightness(1.2)' in st and 'width:' in st and 'width:100%' not in st.replace(' ', ''), st)
    lk = g.evaluate("() => { const a = document.querySelector('a[data-place-link]'); return a ? [a.getAttribute('href'), a.getAttribute('target'), !!a.querySelector('img[alt^=\"Foto de \"]'), a.getAttribute('aria-label'), a.querySelector('[data-testid=place-link-badge]').textContent.trim()] : null; }")
    ok('Mapa: tocar na foto do local abre o link em outra aba', lk and lk[0] == 'https://instagram.com/espaco.villa' and lk[1] == '_blank' and lk[2], lk)
    ok('Mapa: selo "Instagram" na foto e descrição para leitores de tela', lk and lk[4] == 'Instagram' and 'Instagram' in lk[3] and 'outra aba' in lk[3], lk)
    ctx.route('https://instagram.com/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<title>ok</title>'))
    with ctx.expect_page() as pop:
        g.click('a[data-place-link]')
    np = pop.value
    ok('Mapa: o link abre numa aba nova', 'instagram.com/espaco.villa' in np.url, np.url)
    np.close()
    ok('Mapa: o convite continua aberto na mesma página', 'Detalhes' in g.evaluate("() => (document.querySelector('nav[aria-label=\"Páginas do convite\"] [aria-current=page]') || {}).textContent || ''"))
    ctx.close()
    # remover a foto volta ao ícone
    pg.click('button:has-text("Remover foto")'); pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    mp = [b for p in inv['pages'] for b in p['blocks'] if b['type'] == 'mapa'][0]
    ok('Mapa: remover a foto volta ao ícone', not mp.get('photoUrl') and count(pg, '#place-file') == 1, mp)
    # ordem das páginas
    names = lambda: [__import__('re').sub(r'^\d+\.\s*', '', x.strip()) for x in pg.locator('aside button.pg span[style*="font-weight: 600"]').all_inner_texts()]
    n0 = names()
    ok('Páginas: sem setas de ordem (só arrastar)', count(pg, '[aria-label^="Mover a página"]') == 0 and count(pg, '[data-page-handle]') == len(n0), n0)
    # arrastar com o dedo pela alça ⋮⋮ (eventos de toque)
    pg.evaluate("() => { window.scrollTo(0, 0); document.querySelector('aside [data-page]').scrollIntoView({ block: 'nearest' }); }"); pg.wait_for_timeout(150)
    pg.evaluate("""() => {
      const it = (i) => document.querySelectorAll('aside [data-page]')[i];
      const h = it(1).querySelector('[data-page-handle]').getBoundingClientRect();
      const t = it(2).getBoundingClientRect();
      const ev = (type, el, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 7, button: 0, clientX: x, clientY: y }));
      ev('pointerdown', it(1).querySelector('[data-page-handle]'), h.x + h.width / 2, h.y + h.height / 2);
      ev('pointermove', window, h.x + h.width / 2, h.y + 20);
      ev('pointermove', window, t.x + t.width / 2, t.y + t.height / 2);
      ev('pointerup', window, t.x + t.width / 2, t.y + t.height / 2);
    }"""); pg.wait_for_timeout(300)
    n1 = names()
    ok('Páginas: arrastar com o dedo pela alça muda a ordem', n1[:3] == [n0[0], n0[2], n0[1]], n1)
    # toque fora da alça não arrasta (o dedo rola a lista)
    pg.evaluate("""() => {
      const it = (i) => document.querySelectorAll('aside [data-page]')[i];
      const a = it(1).getBoundingClientRect(), t = it(2).getBoundingClientRect();
      const ev = (type, el, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', pointerId: 8, button: 0, clientX: x, clientY: y }));
      ev('pointerdown', it(1).querySelector('button.pg span:last-child'), a.x + a.width - 20, a.y + a.height / 2);
      ev('pointermove', window, t.x + t.width - 20, t.y + t.height / 2);
      ev('pointerup', window, t.x + t.width - 20, t.y + t.height / 2);
    }"""); pg.wait_for_timeout(300)
    ok('Páginas: com o dedo, fora da alça, não arrasta', names() == n1, names())
    # teclado: Alt + ↑ desfaz
    pg.locator('aside [data-page]').nth(2).locator('button.pg').focus()
    pg.keyboard.press('Alt+ArrowUp'); pg.wait_for_timeout(300)
    ok('Páginas: Alt + seta para cima no teclado muda a ordem', names() == n0, names())
    ok('Páginas: foco continua na página movida', pg.evaluate("() => document.activeElement.closest('[data-page]').getAttribute('data-page')") == pg.locator('aside [data-page]').nth(1).get_attribute('data-page'))
    last = n0[-1]
    pg.locator('[data-page]').nth(len(n0) - 1).drag_to(pg.locator('[data-page]').nth(1)); pg.wait_for_timeout(400)
    n2 = names()
    ok('Páginas: arrastar muda a ordem', n2[1] == last and n2[0] == n0[0] and len(n2) == len(n0), n2)
    pg.wait_for_timeout(1800)
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    ok('Páginas: nova ordem salva', [p['name'] for p in inv['pages']] == n2, [p['name'] for p in inv['pages']])
    ok('Páginas: abas da prévia seguem a nova ordem', [t.strip() for t in pg.locator('nav[aria-label="Páginas do convite"] button').all_inner_texts()] == n2)



def t_client(pg, browser):
    """Conta do cliente: dar acesso por link, permissões do perfil Cliente e transferência de convites."""
    J = "async ([m, u, b]) => { const r = await fetch(u, {method: m, headers: {'content-type': 'application/json'}, body: b}); let d = null; try { d = await r.json(); } catch (e) {} return [r.status, d]; }"
    page = [{'name': 'Capa', 'blocks': [{'type': 'texto', 'text': 'Festa da Carla'}, {'type': 'rsvp', 'text': 'Confirme', 'deadline': '2027-03-01'}]}]
    inv = api_invite(pg, {'anim': 'nenhuma'}, page, title='Festa da Carla')
    pg.evaluate(J, ['PUT', '/api/invites?id=' + inv['id'], '{"title":"Festa da Carla"}'])
    go(pg, 'Main', 1300)
    open_menu(pg, 'Festa da Carla')
    ok('Cliente: menu do administrador tem "Dar acesso" e "Transferir"', count(pg, '[data-testid="menu-acesso"]') == 1 and count(pg, '[data-testid="menu-transferir"]') == 1)
    pg.click('[data-testid="menu-acesso"]'); pg.wait_for_timeout(500)
    ok('Cliente: modal de acesso abre com nome, WhatsApp e e-mail', all(count(pg, '#acc-' + f) == 1 for f in ['nome', 'whats', 'email']))
    pg.click('[data-testid="modal-acesso"] button[type=submit]'); pg.wait_for_timeout(300)
    ok('Cliente: nome obrigatório', 'Informe o nome' in pg.inner_text('[data-testid="modal-acesso"]'))
    pg.fill('#acc-nome', 'Carla Souza'); pg.fill('#acc-whats', '(11) 98765-4321')
    pg.click('[data-testid="modal-acesso"] button[type=submit]'); pg.wait_for_timeout(1200)
    ok('Cliente: acesso gerado', count(pg, '[data-testid="acesso-pronto"]') == 1, text(pg)[-400:])
    link = pg.input_value('[data-testid="acesso-link"]') if count(pg, '[data-testid="acesso-link"]') else ''
    msg = pg.input_value('#acc-msg') if count(pg, '#acc-msg') else ''
    wa = pg.get_attribute('[data-testid="acesso-whats"]', 'href') if count(pg, '[data-testid="acesso-whats"]') else ''
    ok('Cliente: link de acesso no endereço do site', '/#/Acesso/' in link and link.startswith('http'), link)
    ok('Cliente: mensagem pronta com link e usuário', link in msg and 'carla.souza' in msg and 'Festa da Carla' in msg, msg)
    ok('Cliente: botão do WhatsApp já com o número e a mensagem', wa.startswith('https://wa.me/5511987654321?text='), wa)
    pg.click('[data-testid="acesso-pronto"] button:has-text("Concluir")'); pg.wait_for_timeout(900)
    card = 'article:has-text("Festa da Carla")'
    ok('Cliente: cartão mostra o dono com a etiqueta Cliente', count(pg, card + ' [data-owner="Carla Souza"]') == 1 and count(pg, card + ' [data-testid="badge-cliente"]') == 1)

    # cliente abre o link e cria a senha
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    cp = ctx.new_page(); cp.set_default_timeout(6000)
    cp.on('pageerror', lambda e: errors.append('[cliente] %s' % e))
    cp.goto(link); cp.wait_for_timeout(1200)
    ok('Acesso: link abre a tela de criar senha, sem login', count(cp, '[data-testid="acesso-form"]') == 1 and 'Olá, Carla' in text(cp), text(cp)[:300])
    ok('Acesso: mostra o nome de usuário', cp.inner_text('[data-testid="acesso-usuario"]') == 'carla.souza')
    cp.fill('#novasenha', 'curta'); cp.fill('#confirma', 'curta'); cp.click('button:has-text("Criar senha e entrar")'); cp.wait_for_timeout(300)
    ok('Acesso: senha curta recusada', '8 caracteres' in text(cp))
    cp.fill('#novasenha', 'carlaFesta2026'); cp.fill('#confirma', 'carlaFesta2027'); cp.click('button:has-text("Criar senha e entrar")'); cp.wait_for_timeout(300)
    ok('Acesso: senhas diferentes recusadas', 'não são iguais' in text(cp))
    cp.fill('#novasenha', '12345678'); cp.fill('#confirma', '12345678'); cp.click('button:has-text("Criar senha e entrar")'); cp.wait_for_timeout(800)
    ok('Acesso: senha fácil recusada pelo servidor', 'fácil demais' in text(cp))
    cp.fill('#novasenha', 'carlaFesta2026'); cp.fill('#confirma', 'carlaFesta2026'); cp.click('button:has-text("Criar senha e entrar")'); cp.wait_for_timeout(1500)
    ok('Acesso: cria a senha e entra direto nos convites', count(cp, 'h1:has-text("Olá, Carla")') == 1 and count(cp, 'article[data-invite]') == 1, text(cp)[:300])
    ok('Cliente: sem "Novo convite"', count(cp, 'a:has-text("Novo convite")') == 0)
    ok('Cliente: menu do topo sem Temas e sem Usuários', count(cp, 'nav a:has-text("Temas")') == 0 and count(cp, 'nav a:has-text("Usuários")') == 0 and count(cp, 'nav a:has-text("Meus convites")') == 1)
    open_menu(cp, 'Festa da Carla')
    menu = cp.inner_text('[role=menu]') if count(cp, '[role=menu]') else ''
    ok('Cliente: menu do cartão sem Duplicar, Excluir e Transferir', 'Editar' in menu and 'Convidados e respostas' in menu and 'Duplicar' not in menu and 'Excluir' not in menu and 'Transferir' not in menu, menu)
    for r in ['Novo', 'CriarTema', 'Temas', 'Usuarios']:
        go(cp, r, 1000)
        ok('Cliente: endereço ' + r + ' volta para os convites', count(cp, 'h1:has-text("Olá, Carla")') == 1, text(cp)[:120])
    iid = inv['id']
    st, _ = cp.evaluate(J, ['POST', '/api/invites', '{"title":"novo"}'])
    ok('Cliente: API não cria convite', st == 403, st)
    st, _ = cp.evaluate(J, ['DELETE', '/api/invites?id=' + iid, None])
    ok('Cliente: API não exclui convite', st == 403, st)
    st, _ = cp.evaluate(J, ['POST', '/api/themes', '{"name":"x","bg":"#111111","fg":"#EEEEEE","accent":"#C9A227"}'])
    ok('Cliente: API não cria tema', st == 403, st)
    st, _ = cp.evaluate(J, ['PUT', '/api/invites?action=transfer&id=' + iid, '{"ownerId":"admin"}'])
    ok('Cliente: API não transfere convite', st == 403, st)
    st, _ = cp.evaluate(J, ['GET', '/api/users', None])
    ok('Cliente: API de usuários recusada', st == 403, st)
    full = cp.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", iid)
    full['title'] = 'Festa da Carla 30 anos'
    st, d = cp.evaluate(J, ['PUT', '/api/invites?id=' + iid, __import__('json').dumps(full)])
    ok('Cliente: edita o próprio convite', st == 200 and d.get('title') == 'Festa da Carla 30 anos' and d.get('ownerId') == full.get('ownerId'), [st, d and d.get('ownerId')])
    st, _ = cp.evaluate(J, ['POST', '/api/guests?invite=' + iid, '{"name":"Tia Lúcia"}'])
    ok('Cliente: cria convidados no próprio convite', st == 201, st)
    st, _ = cp.evaluate(J, ['GET', '/api/rsvp?invite=' + iid, None])
    ok('Cliente: vê as respostas do próprio convite', st == 200, st)
    go(cp, 'Respostas/' + iid, 1400)
    ok('Cliente: tela de respostas abre', 'Tia Lúcia' in text(cp), text(cp)[:200])
    go(cp, 'Editor/' + iid, 2000)
    safe('Cliente: editor', lambda: tab(cp, 'Tema'))
    ok('Cliente: editor sem "Salvar como novo tema"', count(cp, 'aside[aria-label="Propriedades"]') == 1 and count(cp, 'button:has-text("como novo tema")') == 0)
    go(cp, 'Main', 1200)
    ok('Cliente: perfil "Cliente" no menu da conta', 'Cliente' in (cp.inner_text('[data-testid="user-menu"]') if count(cp, '[data-testid="user-menu"]') else ''))

    # o link vale uma vez
    c2 = browser.new_context(); p2 = c2.new_page(); p2.set_default_timeout(6000)
    p2.goto(link); p2.wait_for_timeout(1200)
    ok('Acesso: link usado não vale de novo', count(p2, '[data-testid="acesso-invalido"]') == 1, text(p2)[:200])
    p2.goto(BASE + '#/Acesso/inexistente123456789012345'); p2.wait_for_timeout(1000)
    ok('Acesso: link inventado recusado', count(p2, '[data-testid="acesso-invalido"]') == 1)
    c2.close()
    lp = login_as(browser, 'carla.souza', 'carlaFesta2026')
    ok('Cliente: entra depois com usuário e senha', count(lp, 'h1:has-text("Olá, Carla")') == 1)
    lp.context.close()

    # administrador transfere de volta
    go(pg, 'Main', 1300)
    open_menu(pg, 'Festa da Carla 30 anos')
    pg.click('[data-testid="menu-transferir"]'); pg.wait_for_timeout(700)
    ok('Transferir: modal mostra a conta atual', 'Carla Souza' in pg.inner_text('[data-testid="modal-transferir"]'))
    pg.click('[data-testid="modal-transferir"] button:has-text("Transferir")'); pg.wait_for_timeout(300)
    ok('Transferir: exige escolher a conta', 'Escolha para qual conta' in pg.inner_text('[data-testid="modal-transferir"]'))
    pg.select_option('#tr-para', 'admin'); pg.click('[data-testid="modal-transferir"] button:has-text("Transferir")'); pg.wait_for_timeout(1200)
    ok('Transferir: convite volta para a conta principal', 'agora está na conta de Administrador principal' in text(pg) and count(pg, 'article:has-text("Festa da Carla 30 anos") [data-testid="badge-cliente"]') == 0, text(pg)[-300:])
    go(cp, 'Main', 1300)
    ok('Cliente: sem convites, vê o aviso próprio (sem "criar")', count(cp, '[data-testid="cliente-vazio"]') == 1 and count(cp, 'article[data-invite]') == 0 and 'Criar meu primeiro' not in text(cp))
    # conta existente: passa o convite de novo para a Carla pela API
    users = pg.evaluate("fetch('/api/users').then(r => r.json())")
    carla = [u for u in users if u['username'] == 'carla.souza'][0]
    st, d = pg.evaluate(J, ['POST', '/api/users?action=client', __import__('json').dumps({'userId': carla['id'], 'inviteId': iid})])
    ok('Dar acesso: conta de cliente existente recebe o convite', st == 201 and d['user']['id'] == carla['id'] and '/#/Acesso/' in d['link'], [st, d and d.get('user')])

    # novo link pelo painel: senha nova derruba a sessão antiga
    go(pg, 'Usuarios', 1300)
    row = pg.inner_text('li[data-user="carla.souza"]')
    ok('Usuários: cliente aparece com o perfil Cliente', 'Cliente' in row, row)
    pg.click('[aria-label="Gerar link de acesso para Carla Souza"]'); pg.wait_for_timeout(900)
    link2 = pg.input_value('[data-testid="link-acesso"]') if count(pg, '[data-testid="link-acesso"]') else ''
    ok('Usuários: "Link de acesso" gera um link novo', '/#/Acesso/' in link2 and link2 != link, link2)
    pg.click('[data-testid="link-modal"] button:has-text("Concluir")'); pg.wait_for_timeout(200)
    c3 = browser.new_context(); p3 = c3.new_page(); p3.set_default_timeout(6000)
    p3.goto(link2); p3.wait_for_timeout(1200)
    p3.fill('#novasenha', 'carlaNova2026'); p3.fill('#confirma', 'carlaNova2026'); p3.click('button:has-text("Criar senha e entrar")'); p3.wait_for_timeout(1500)
    ok('Acesso: novo link troca a senha e entra', count(p3, 'h1:has-text("Olá, Carla")') == 1 and count(p3, 'article[data-invite]') == 1)
    c3.close()
    go(cp, 'Main', 1200)
    ok('Acesso: senha nova encerra a sessão antiga', count(cp, '#pw') == 1)
    ctx.close()

    # cliente criado pelo painel, sem senha e sem e-mail: já mostra o link
    pg.click('button:has-text("+ Novo usuário")'); pg.wait_for_timeout(200)
    pg.fill('#u-name', 'Davi Cliente'); pg.fill('#u-email', '')
    pg.click('[data-testid="usuario-modal"] button[role=radio]:has-text("Cliente")'); pg.wait_for_timeout(100)
    ok('Usuários: senha opcional para cliente', 'opcional' in pg.inner_text('[data-testid="usuario-modal"]'))
    pg.click('[data-testid="usuario-modal"] button:has-text("Salvar")'); pg.wait_for_timeout(1200)
    ok('Usuários: cliente sem senha criado e link mostrado', count(pg, '[data-testid="link-modal"]') == 1 and '/#/Acesso/' in (pg.input_value('[data-testid="link-acesso"]') if count(pg, '[data-testid="link-acesso"]') else ''), text(pg)[-300:])
    pg.click('[data-testid="link-modal"] button:has-text("Concluir")'); pg.wait_for_timeout(200)
    ok('Usuários: aviso de que ainda não criou a senha', 'Ainda não criou a senha' in pg.inner_text('li[data-user="davi.cliente"]'))
    pg.screenshot(path=os.environ['SHOTS'] + '/usuarios-clientes.png', full_page=True) if os.environ.get('SHOTS') else None


def t_pedido(pg, browser):
    """Formulário público de pedido, montagem automática das versões e envio ao cliente."""
    import json as _j
    J = "async ([m, u, b]) => { const r = await fetch(u, {method: m, headers: {'content-type': 'application/json'}, body: b}); let d = null; try { d = await r.json(); } catch (e) {} return [r.status, d]; }"
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    cp = ctx.new_page(); cp.set_default_timeout(8000)
    cp.on('pageerror', lambda e: errors.append('[pedido] %s' % e))
    cp.goto(BASE + 'pedido'); cp.wait_for_timeout(1200)
    ok('Pedido: formulário abre sem login em /pedido', count(cp, '[data-testid="pd-etapa"]') == 1 and 'Etapa 1 de 5' in text(cp), text(cp)[:200])
    cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(200)
    ok('Pedido: exige o tipo de evento', 'Escolha o tipo de evento' in text(cp))
    cp.click('[data-kind="casamento"]'); cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(200)
    ok('Pedido: exige os nomes', 'Nomes do casal' in text(cp) and count(cp, '[role=alert]') == 1)
    cp.fill('#pd-names', 'Helena & Rafael'); cp.fill('#pd-day', '2027-09-12'); cp.fill('#pd-time', '16:30')
    cp.fill('#pd-place', 'Fazenda Santa Clara'); cp.fill('#pd-addr', 'Estrada do Sol, 100, Itu - SP')
    cp.fill('#pd-placeurl', 'fazenda santa clara'); cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(200)
    ok('Pedido: confere o Instagram ou site do local', 'Confira o Instagram ou site do local' in text(cp))
    cp.fill('#pd-placeurl', '@fazendasantaclara')
    cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(600)
    ok('Pedido: galeria de visuais filtrada pelo tipo, com os nomes do cliente', count(cp, '[data-theme="jardim"]') == 1 and count(cp, '[data-theme="festa"]') == 0 and 'Helena & Rafael' in text(cp))
    cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(200)
    ok('Pedido: exige pelo menos um visual', 'pelo menos um visual' in text(cp))
    for t in ['botanico', 'jardim', 'romance']:
        cp.click('[data-theme="' + t + '"]'); cp.wait_for_timeout(80)
    cp.click('[data-theme="noite"]'); cp.wait_for_timeout(150)
    ok('Pedido: no máximo 3 visuais', 'já escolheu 3' in text(cp) and '3 visuais escolhidos' in cp.inner_text('[data-testid="pd-escolhidos"]'))
    cp.click('[data-theme="romance"]'); cp.wait_for_timeout(100)
    cp.click('button:has-text("Ver todos os visuais")'); cp.wait_for_timeout(300)
    ok('Pedido: "Ver todos os visuais" mostra os outros tipos', count(cp, '[data-theme="festa"]') == 1)
    cp.reload(); cp.wait_for_timeout(1200)
    ok('Pedido: rascunho guardado ao recarregar a página', 'Etapa 2 de 5' in text(cp) and '2 visuais escolhidos' in cp.inner_text('[data-testid="pd-escolhidos"]'))
    cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(300)
    cp.set_input_files('#pd-foto-principal', FIX + 'foto.png'); cp.wait_for_timeout(1500)
    cp.set_input_files('#pd-galeria', [FIX + 'foto.png', FIX + 'paisagem.jpg']); cp.wait_for_timeout(2500)
    cp.set_input_files('#pd-foto-local', FIX + 'paisagem.jpg'); cp.wait_for_timeout(1500)
    ok('Pedido: fotos enviadas sem login (principal, galeria e local)', count(cp, '[data-testid="pd-foto-principal"] img') == 1 and count(cp, '[data-testid="pd-galeria-item"]') == 2 and count(cp, '[data-testid="pd-foto-local"] img') == 1, text(cp)[-300:])
    cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(300)
    ok('Pedido: frase da capa sugere o texto padrão do tipo', 'convidam para a celebração' in (cp.get_attribute('#pd-frase', 'placeholder') or ''))
    cp.fill('#pd-traje', 'Esporte fino'); cp.fill('#pd-prog', '16h30 Cerimônia\n18h Jantar\n20h Festa')
    cp.fill('#pd-presentes', 'www.listadopresente.com.br/helena'); cp.fill('#pd-orient', 'Estacionamento no local'); cp.select_option('#pd-musica', 'valsa')
    cp.click('[data-testid="pd-continuar"]'); cp.wait_for_timeout(300)
    ok('Pedido: resumo antes de enviar', '2 visuais' in text(cp) and '4 fotos' in text(cp), text(cp)[:300])
    cp.click('[data-testid="pd-enviar"]'); cp.wait_for_timeout(300)
    ok('Pedido: exige o nome de quem pede', 'Informe o seu nome' in text(cp))
    cp.fill('#pd-nome', 'Helena Prado'); cp.fill('#pd-whats', '1198'); cp.click('[data-testid="pd-enviar"]'); cp.wait_for_timeout(300)
    ok('Pedido: exige WhatsApp com DDD', 'WhatsApp com DDD' in cp.inner_text('[role=alert]'))
    cp.fill('#pd-whats', '(11) 98888-7777'); cp.fill('#pd-msg', 'Queremos tons de verde.')
    cp.click('[data-testid="pd-enviar"]'); cp.wait_for_timeout(1800)
    ok('Pedido: enviado com mensagem de confirmação', count(cp, '[data-testid="pd-enviado"]') == 1 and 'Obrigado, Helena' in text(cp), text(cp)[:300])
    ok('Pedido: rascunho apagado do navegador depois de enviar', cp.evaluate("localStorage.getItem('ci:pedido')") in (None, 'null'))
    # proteções do servidor
    base = {'kind': 'casamento', 'names': 'X & Y', 'themes': ['jardim'], 'contact': {'name': 'Z', 'phone': '11999998888'}}
    st, _ = cp.evaluate(J, ['POST', '/api/pedidos?action=send', _j.dumps(dict(base, photos={'main': {'url': 'https://exemplo.com/foto.jpg'}}))])
    ok('Pedido: recusa foto de fora da plataforma', st == 400, st)
    st, _ = cp.evaluate(J, ['POST', '/api/pedidos?action=send', _j.dumps(dict(base, site='http://spam'))])
    ok('Pedido: campo escondido (robôs) recusado', st == 400, st)
    st, _ = cp.evaluate(J, ['POST', '/api/pedidos?action=send', _j.dumps(dict(base, themes=['inexistente']))])
    ok('Pedido: recusa visual inexistente', st == 400, st)
    st = cp.evaluate("fetch('/api/upload?name=x.png', {method: 'POST', headers: {'Content-Type': 'image/png'}, body: 'x'}).then(r => r.status)")
    ok('Pedido: envio de arquivo sem login e sem código recusado', st == 401, st)
    key = cp.evaluate("fetch('/api/pedidos?action=start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'}).then(r => r.json()).then(d => d.key)")
    st = cp.evaluate("(k) => fetch('/api/upload?name=x.mp3&pedido=' + k, {method: 'POST', headers: {'Content-Type': 'audio/mpeg'}, body: 'x'}).then(r => r.status)", key)
    ok('Pedido: código do pedido só envia fotos', st == 415, st)
    st, _ = cp.evaluate(J, ['GET', '/api/pedidos', None])
    ok('Pedido: lista de pedidos só para administradores', st == 401, st)
    ctx.close()

    # administrador: pedido chega com as versões montadas
    go(pg, 'Main', 1300)
    ok('Pedidos: aviso de pedido novo no menu', count(pg, '[data-testid="badge-pedidos"]') == 1)
    ok('Pedidos: cartões das versões marcados como pedido', count(pg, '[data-testid="card-pedido"]') == 2)
    orders = pg.evaluate("fetch('/api/pedidos').then(r => r.json())")
    o = [x for x in orders if x['names'] == 'Helena & Rafael'][0]
    ok('Pedidos: uma versão por visual escolhido', len(o['invites']) == 2 and [v['themeName'] for v in o['versions']] == ['Jardim botânico', 'Jardim'], [v['themeName'] for v in o['versions']])
    inv = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", o['invites'][0])
    pages = {p['name']: p['blocks'] for p in inv['pages']}
    bl = lambda pn, t: [x for x in pages.get(pn, []) if x['type'] == t]
    ok('Montagem: páginas conforme o pedido', list(pages.keys()) == ['Capa', 'Detalhes', 'Programação', 'Galeria', 'Presença'], list(pages.keys()))
    ok('Montagem: capa com nomes e foto do cliente', bl('Capa', 'titulo')[0]['text'] == 'Helena & Rafael' and bl('Capa', 'foto')[0].get('fileUrl', '').startswith('/api/upload'))
    ok('Montagem: data por extenso e local com foto', bl('Detalhes', 'texto')[0]['text'] == 'Domingo, 12 de setembro de 2027\nÀs 16h30' and bl('Detalhes', 'mapa')[0].get('photoUrl') and bl('Detalhes', 'mapa')[0]['address'] == 'Estrada do Sol, 100, Itu - SP')
    ok('Montagem: link do local no bloco do mapa', bl('Detalhes', 'mapa')[0].get('placeUrl') == 'https://instagram.com/fazendasantaclara', bl('Detalhes', 'mapa')[0].get('placeUrl'))
    ok('Montagem: traje e orientações', bl('Detalhes', 'orientacoes')[0]['text'] == 'Traje: Esporte fino\nEstacionamento no local')
    btn = bl('Detalhes', 'botao')[0]
    ok('Montagem: botão da lista de presentes com o link', btn['text'] == 'Lista de presentes' and btn.get('action') == 'link' and btn.get('dest') == 'https://www.listadopresente.com.br/helena', btn)
    ok('Montagem: programação e galeria com as fotos', bl('Programação', 'programacao')[0]['text'].startswith('16h30 Cerimônia') and len(bl('Galeria', 'galeria')[0]['items']) == 2)
    ok('Montagem: prazo de resposta 30 dias antes', (bl('Presença', 'rsvp')[0].get('deadline') or '').startswith('2027-08-14'), bl('Presença', 'rsvp')[0].get('deadline'))
    ok('Montagem: data, música, abertura e tema', inv['eventDate'] == '2027-09-12T19:30:00.000Z' and inv['music']['kind'] == 'biblioteca' and inv['music']['preset'] == 'valsa' and inv['opening'].get('photoUrl') and inv['theme']['baseName'] == 'Jardim botânico' and inv['status'] == 'rascunho', [inv['eventDate'], inv['music'], inv['theme'].get('baseName')])
    ok('Montagem: sem textos de exemplo', not any('[' in (x.get('text') or '') for p in inv['pages'] for x in p['blocks']))
    go(pg, 'c/' + o['invites'][0], 2500)
    if count(pg, '[data-som="sim"]'): pg.click('[data-som="sim"]'); pg.wait_for_timeout(600)
    ok('Montagem: versão abre como convite', 'Helena & Rafael' in text(pg) or count(pg, '[data-testid="abertura"], [data-anim]') > 0, text(pg)[:200])

    go(pg, 'Pedidos', 1500)
    art = 'article[data-pedido="' + o['id'] + '"]'
    ok('Pedidos: tela lista o pedido com as versões', count(pg, art) == 1 and count(pg, art + ' [data-versao]') == 2 and 'Helena Prado' in pg.inner_text(art))
    ok('Pedidos: link do formulário', pg.inner_text('[data-testid="link-formulario"]').endswith('/pedido'))
    pg.click(art + ' button:has-text("Ver o pedido completo")'); pg.wait_for_timeout(300)
    det = pg.inner_text(art + ' [data-testid="pedido-detalhes"]')
    ok('Pedidos: detalhes completos do pedido', 'Queremos tons de verde.' in det and 'Esporte fino' in det and 'Valsa suave' in det and count(pg, art + ' [data-testid="pedido-detalhes"] img') == 4, det[:300])
    pg.fill('#nota-' + o['id'], 'Cobrar sinal'); pg.click('h1'); pg.wait_for_timeout(700)
    ok('Pedidos: anotação interna salva', pg.evaluate("(id) => fetch('/api/pedidos').then(r => r.json()).then(l => l.find(x => x.id === id).note)", o['id']) == 'Cobrar sinal')
    pg.click(art + ' [data-versao="' + o['invites'][0] + '"] button:has-text("Enviar ao cliente")'); pg.wait_for_timeout(500)
    ok('Enviar: dados do cliente já preenchidos', pg.input_value('#sd-nome') == 'Helena Prado' and pg.input_value('#sd-whats') == '(11) 98888-7777' and pg.is_checked('#sd-apagar'))
    pg.click('[data-testid="modal-enviar"] button[type=submit]'); pg.wait_for_timeout(1800)
    ok('Enviar: acesso gerado com link e WhatsApp', count(pg, '[data-testid="enviar-pronto"]') == 1 and '/#/Acesso/' in pg.input_value('[data-testid="enviar-link"]') and pg.get_attribute('[data-testid="enviar-whats"]', 'href').startswith('https://wa.me/5511988887777'), text(pg)[-300:])
    pg.click('[data-testid="enviar-pronto"] button:has-text("Concluir")'); pg.wait_for_timeout(300)
    o2 = [x for x in pg.evaluate("fetch('/api/pedidos').then(r => r.json())") if x['id'] == o['id']][0]
    ok('Enviar: pedido marcado como entregue, com a versão escolhida', o2['status'] == 'entregue' and o2['chosen'] == o['invites'][0] and o2['invites'] == [o['invites'][0]], [o2['status'], o2['chosen']])
    st, _ = pg.evaluate(J, ['GET', '/api/invites?id=' + o['invites'][1], None])
    ok('Enviar: a outra versão foi apagada', st == 404, st)
    ok('Enviar: convite na conta do cliente', o2['versions'][0]['ownerId'] != 'admin')
    go(pg, 'Pedidos', 1300)
    ok('Pedidos: entregue sai de "Em aberto"', count(pg, art) == 0)
    pg.click('button:has-text("Entregues")'); pg.wait_for_timeout(300)
    ok('Pedidos: aparece em "Entregues", já sem "Enviar ao cliente"', count(pg, art) == 1 and count(pg, art + ' button:has-text("Enviar ao cliente")') == 0 and 'Já está na conta do cliente' in pg.inner_text(art))
    pg.select_option(art + ' select', 'arquivado'); pg.wait_for_timeout(800)
    ok('Pedidos: mudar a situação', count(pg, art) == 0 and 'Arquivados · 1' in text(pg))
    pg.screenshot(path=os.environ['SHOTS'] + '/pedidos.png', full_page=True) if os.environ.get('SHOTS') else None


def api_invite(pg, theme, pages, opening=None, title='Ana & Pedro'):
    base = dict(baseName='Teste', bg='#1F3329', fg='#F3EEE4', accent='#CDAE6B', btnFg='#1F3329', paper='#E9E1D0', ph='#2B4538', fontKey='cormorant', italic=False, layout='centro', radiusKey='pilula', anim='nenhuma')
    base.update(theme)
    body = dict(title='Design ' + base['anim'] + ' ' + base['layout'], kicker='Casamento', coverTitle=title, status='publicado', theme=base, themeBase=base,
                eventDate='2027-04-17T19:00:00.000Z', opening=opening or {'headline': 'Você recebeu um convite'}, pages=pages)
    return pg.evaluate("(b) => fetch('/api/invites', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(b)}).then(r => r.json())", body)


def t_design(pg, browser):
    """Convites mais bonitos: aberturas, layouts, fotos, galeria, divisores, efeitos e temas novos."""
    errs = []
    # ---------- galeria de temas ----------
    go(pg, 'Temas', 1500)
    for name in ['Jardim botânico', 'Gatsby', 'Aurora', 'Capa de revista', 'Chá revelação', 'Balões', 'Memórias']:
        ok('Temas novos: ' + name, count(pg, '[aria-label="Tema ' + name + '"]') == 1)
    ok('Temas novos: selo "Novo"', count(pg, '[data-testid="badge-novo"]') >= 10, count(pg, '[data-testid="badge-novo"]'))
    pg.select_option('#f-anim', 'raspadinha'); pg.wait_for_timeout(300)
    ok('Temas: filtro pelas aberturas novas', count(pg, '[aria-label="Tema Chá revelação"]') == 1 and count(pg, '[aria-label="Tema Jardim"]') == 0)
    pg.select_option('#f-anim', 'todas'); pg.select_option('#f-layout', 'deco'); pg.wait_for_timeout(300)
    ok('Temas: filtro pelos layouts novos', count(pg, '[aria-label="Tema Gatsby"]') == 1 and count(pg, '[aria-label="Tema Jardim"]') == 0)
    pg.select_option('#f-layout', 'todos')

    # ---------- editor: blocos novos ----------
    pages = [{'id': 'capa', 'name': 'Capa', 'blocks': [{'id': 'c1', 'type': 'foto', 'src': 'upload', 'label': 'Nós dois', 'anim': 'nenhuma'}, {'id': 'c2', 'type': 'titulo', 'text': 'Ana & Pedro'}, {'id': 'c3', 'type': 'contagem'}]},
             {'id': 'p2', 'name': 'Detalhes', 'blocks': [{'id': 'd1', 'type': 'titulo', 'text': 'Detalhes'}]}]
    inv = api_invite(pg, {'layout': 'botanico'}, pages)
    state['design'] = inv['id']
    pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, 'Editor/' + inv['id'], 2200)
    ok('Editor: layout botânico com ramos na prévia', pg.locator('[data-canvas] svg[viewBox="0 0 100 100"]').count() == 2)
    # foto: forma, moldura, legenda e movimento
    pg.click('[data-ovl="c1"]'); pg.wait_for_timeout(200)
    pg.set_input_files('#media-file', FIX + 'foto.png'); pg.wait_for_timeout(1500)
    pg.select_option('#foto-shape', 'coracao'); pg.select_option('#foto-frame', 'polaroid'); pg.select_option('#foto-motion', 'kenburns')
    pg.check('#foto-caption'); pg.wait_for_timeout(300)
    fr = pg.locator('[data-canvas] [data-photo-frame]').first
    ok('Foto: forma e moldura na prévia', fr.get_attribute('data-photo-shape') == 'coracao' and fr.get_attribute('data-photo-frame') == 'polaroid')
    ok('Foto: legenda escrita na moldura', 'Nós dois' in fr.inner_text())
    ok('Foto: movimento lento', pg.locator('[data-canvas] .pm-kenburns').count() == 1)
    # contagem: estilo
    pg.click('[data-ovl="c3"]'); pg.wait_for_timeout(200)
    pg.select_option('#cd-style', 'flip'); pg.wait_for_timeout(200)
    ok('Contagem: estilo relógio de placas', pg.locator('[data-canvas] [data-cd-style="flip"]').count() == 1)
    # galeria
    add_block(pg, 'Galeria de fotos')
    ok('Galeria: bloco novo com espaços de exemplo', pg.locator('[data-canvas] [data-gallery="carrossel"]').count() == 1)
    pg.set_input_files('#gal-files', [FIX + 'foto.png', FIX + 'paisagem.jpg', FIX + 'foto.png']); pg.wait_for_timeout(2500)
    ok('Galeria: três fotos enviadas', pg.locator('[data-testid="gal-list"] li').count() == 3)
    pg.click('button[aria-label="Remover a foto 3"]'); pg.wait_for_timeout(200)
    pg.click('button[aria-label="Mover a foto 2 para antes"]'); pg.wait_for_timeout(200)
    ok('Galeria: remover e reordenar', pg.locator('[data-testid="gal-list"] li').count() == 2)
    pg.click('button[data-gstyle="mosaico"]'); pg.wait_for_timeout(200)
    ok('Galeria: estilo mosaico', pg.locator('[data-canvas] [data-gallery="mosaico"] img').count() == 2)
    # divisor, programação, frase
    add_block(pg, 'Divisor')
    pg.click('button[data-ostyle="estrelas"]'); pg.wait_for_timeout(150)
    ok('Divisor: estilo escolhido', pg.locator('button[data-ostyle="estrelas"]').get_attribute('aria-pressed') == 'true')
    add_block(pg, 'Programação')
    pg.fill('#blk-text', '16h Cerimônia | Capela\n19h30 Festa'); pg.locator('#blk-text').blur(); pg.wait_for_timeout(200)
    add_block(pg, 'Frase em destaque')
    pg.fill('#blk-text', 'O amor é paciente.'); pg.locator('#blk-text').blur()
    pg.fill('#quote-author', '1 Coríntios 13'); pg.locator('#quote-author').blur(); pg.wait_for_timeout(200)
    # aparência: efeitos e transição, fontes e layouts novos
    tab(pg, 'Tema')
    ok('Aparência: 15 layouts e 16 fontes', pg.locator('#th-layout option').count() == 15 and pg.locator('#th-font option').count() == 16)
    pg.select_option('#th-fx', 'neve'); pg.select_option('#th-pagefx', 'deslizar'); pg.wait_for_timeout(300)
    ok('Aparência: efeito de neve na prévia', pg.locator('[data-canvas] [data-fx="neve"] span').count() > 10)
    tab(pg, 'Abertura')
    ok('Abertura: 18 opções', pg.locator('#op-anim option').count() == 18)
    pg.select_option('#op-anim', 'polaroid'); pg.wait_for_timeout(300)
    pg.set_input_files('#op-photo', FIX + 'paisagem.jpg'); pg.wait_for_timeout(1500)
    ok('Abertura: foto revelada na prévia', pg.locator('main img[src*="paisagem"], main img[src^="/api/upload"], main img[src^="blob:"]').count() >= 1)
    wait_saved(pg, 10000)
    saved = pg.evaluate("(id) => fetch('/api/invites?id=' + id).then(r => r.json())", inv['id'])
    blocks = saved['pages'][0]['blocks']
    gal = [b for b in blocks if b['type'] == 'galeria']
    ok('Salvo: galeria com 2 fotos enviadas', len(gal) == 1 and len(gal[0].get('items', [])) == 2 and all(not i['url'].startswith('blob:') for i in gal[0]['items']), gal)
    ok('Salvo: efeito, transição e foto da abertura', saved['theme'].get('fx') == 'neve' and saved['theme'].get('pageFx') == 'deslizar' and bool(saved['opening'].get('photoUrl')) and not saved['opening']['photoUrl'].startswith('blob:'))
    ok('Editor: sem erros de script', not errs, errs[:3])

    # ---------- convidado ----------
    ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
    gerrs = []
    g.on('pageerror', lambda e: gerrs.append(str(e)))
    g.goto(BASE + 'c/' + inv['id']); g.wait_for_timeout(1500)
    ok('Convidado: abertura com a foto', g.locator('img[src*="upload"], img[src*="paisagem"]').count() >= 1)
    g.mouse.click(195, 420); g.wait_for_timeout(3300)
    ok('Convidado: abriu depois de revelar a foto', count(g, 'nav[aria-label="Páginas do convite"]') == 1)
    ok('Convidado: neve caindo', g.locator('[data-fx="neve"] span').count() > 10)
    ok('Convidado: foto em coração com polaroid', g.locator('[data-photo-shape="coracao"][data-photo-frame="polaroid"]').count() == 1)
    ok('Convidado: programação com horários', '19h30' in text(g) and 'Cerimônia' in text(g))
    ok('Convidado: frase com autor', 'O amor é paciente.' in text(g) and '1 CORÍNTIOS 13' in text(g).upper())
    ok('Convidado: divisor', g.locator('svg[viewBox="0 0 240 30"]').count() >= 1)
    g.locator('[data-gallery="mosaico"] button').first.click(); g.wait_for_timeout(400)
    ok('Convidado: foto da galeria amplia', count(g, '[data-testid="lightbox"]') == 1 and '1 de 2' in g.inner_text('[data-testid="lightbox"]'))
    g.click('button[aria-label="Próxima foto"]'); g.wait_for_timeout(150)
    ok('Convidado: passa para a próxima foto', '2 de 2' in g.inner_text('[data-testid="lightbox"]'))
    g.keyboard.press('Escape'); g.wait_for_timeout(200)
    ok('Convidado: Esc fecha a foto', count(g, '[data-testid="lightbox"]') == 0)
    g.click('nav[aria-label="Páginas do convite"] button:has-text("Detalhes")'); g.wait_for_timeout(150)
    ok('Convidado: transição deslizando para o lado', g.locator('main.pg-deslizar-n').count() == 1)
    ok('Convidado: sem erros de script', not gerrs, gerrs[:3])
    ctx.close()

    # ---------- todas as aberturas novas abrem ----------
    simple = [{'id': 'capa', 'name': 'Capa', 'blocks': [{'id': 'c1', 'type': 'titulo', 'text': 'Ana & Pedro'}]}, {'id': 'p2', 'name': 'Mais', 'blocks': [{'id': 'm1', 'type': 'texto', 'text': 'Oi'}]}]
    for anim in ['dobradura', 'ingresso', 'raspadinha', 'confete', 'baloes', 'petalas', 'persiana', 'polaroid', 'monograma']:
        iv = api_invite(pg, {'anim': anim}, simple)
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}); g = ctx.new_page()
        aerrs = []
        g.on('pageerror', lambda e: aerrs.append(str(e)))
        g.goto(BASE + 'c/' + iv['id']); g.wait_for_timeout(1300)
        closed = count(g, 'nav[aria-label="Páginas do convite"]') == 0
        if anim == 'raspadinha':
            box = g.locator('canvas[data-scratch]').bounding_box()
            g.mouse.click(195, 200); g.wait_for_timeout(300)
            still = count(g, 'canvas[data-scratch]') == 1
            for row in range(6):
                y = box['y'] + 15 + row * (box['height'] - 30) / 5
                g.mouse.move(box['x'] + 5, y); g.mouse.down(); g.mouse.move(box['x'] + box['width'] - 5, y, steps=14); g.mouse.up()
            ok('Abertura raspadinha: tocar fora não abre (precisa raspar)', still)
        else:
            g.mouse.click(195, 420)
        g.wait_for_timeout(3200)
        ok('Abertura ' + anim + ': fecha e depois abre o convite', closed and count(g, 'nav[aria-label="Páginas do convite"]') == 1 and not aerrs, aerrs[:2])
        ctx.close()

    # ---------- tema próprio com efeito ----------
    go(pg, 'CriarTema', 1500)
    pg.fill('#t-name' if count(pg, '#t-name') else 'input[id*="name"]', 'Tema efeitos')
    pg.click('button:has-text("Próximo")'); pg.wait_for_timeout(200)
    pg.select_option('#t-font', 'cinzel')
    pg.click('button:has-text("Próximo")'); pg.wait_for_timeout(300)
    pg.select_option('#t-fx', 'brilhos'); pg.select_option('#t-pagefx', 'virar')
    ok('Criar tema: layouts e aberturas novos', pg.locator('button.tile').count() >= 15 + 18)
    pg.click('button:has-text("Salvar tema")'); pg.wait_for_timeout(1200)
    th = pg.evaluate("() => fetch('/api/themes').then(r => r.json()).then(l => l.find(t => t.name === 'Tema efeitos'))")
    ok('Criar tema: salva fonte, efeito e transição', th and th.get('fontKey') == 'cinzel' and th.get('fx') == 'brilhos' and th.get('pageFx') == 'virar', th)

def t_ux(pg, browser):
    # novo convite completo: casamento com Save the Date
    go(pg, 'Main', 1200)
    pg.click('a.newbtn'); pg.wait_for_timeout(800)
    pg.click('button.nv-type:has-text("Casamento")'); pg.fill('#nv-names', 'Amanda & Flávio')
    pg.fill('#nv-day', '2027-06-05'); pg.fill('#nv-time', '17:00'); pg.fill('#nv-place', 'Recafé'); pg.fill('#nv-addr', 'Rua Mariana Junqueira, 33, Ribeirão Preto')
    pg.click('button:has-text("Escolher o visual")'); pg.wait_for_timeout(1200)
    pg.click('[aria-label="Tema Save the Date"]'); pg.click('button:has-text("Criar convite")'); pg.wait_for_timeout(2500)
    uid = pg.url.split('#/Editor/')[1]
    wait_saved(pg)
    ok('UX: Save the Date nasce com nomes e data', count(pg, '[data-canvas] [data-bid] >> text=AMANDA & FLÁVIO') == 1 and count(pg, '[data-canvas] [data-bid] >> text=05 . 06 . 2027') == 1)
    ok('UX: título do convite com o evento', pg.input_value('#inv-title') == 'Casamento Amanda & Flávio')
    # adicionar bloco com descrição
    pg.click('[data-testid="add-block"]'); pg.wait_for_timeout(200)
    ok('UX: adicionar bloco mostra os tipos com descrição', count(pg, 'button.addb') == 13 and 'Formulário de presença' in text(pg) and 'Galeria de fotos' in text(pg))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100)
    n0 = len(ovl(pg))
    add_block(pg, 'Texto'); pg.wait_for_timeout(300)
    ok('UX: bloco adicionado e selecionado', len(ovl(pg)) == n0 + 1 and pg.input_value('#blk-text') == 'Escreva aqui.')
    # duplicar e desfazer/refazer
    pg.click('button[aria-label="Duplicar bloco"]'); pg.wait_for_timeout(300)
    ok('UX: duplicar bloco', len(ovl(pg)) == n0 + 2)
    pg.wait_for_timeout(1000)
    pg.click('button[aria-label="Desfazer"]'); pg.wait_for_timeout(300)
    ok('UX: desfazer remove a cópia', len(ovl(pg)) == n0 + 1, len(ovl(pg)))
    pg.click('button[aria-label="Refazer"]'); pg.wait_for_timeout(300)
    ok('UX: refazer traz de volta', len(ovl(pg)) == n0 + 2)
    pg.click('body', position={'x': 5, 'y': 400}); pg.keyboard.press('Control+z'); pg.wait_for_timeout(300)
    ok('UX: Ctrl+Z desfaz', len(ovl(pg)) == n0 + 1)
    # editar texto direto na prévia
    pg.locator('[data-ovl="c1"]').dblclick(); pg.wait_for_timeout(250)
    ok('UX: duplo clique abre edição na prévia', count(pg, '[data-testid="inline-edit"]') == 1)
    pg.fill('[data-testid="inline-edit"]', 'Vamos casar!'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ok('UX: Enter confirma o texto na prévia', count(pg, '[data-testid="inline-edit"]') == 0 and count(pg, '[data-canvas] [data-bid="c1"] >> text=Vamos casar!') == 1)
    pg.locator('[data-ovl="c1"]').dblclick(); pg.wait_for_timeout(200)
    pg.fill('[data-testid="inline-edit"]', 'outro'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok('UX: Esc cancela a edição na prévia', count(pg, '[data-canvas] [data-bid="c1"] >> text=Vamos casar!') == 1)
    # abas e seções da aparência
    ok('UX: painel com três abas', [t.strip() for t in pg.locator('aside[aria-label="Propriedades"] [role=tab]').all_inner_texts()] == ['Conteúdo', 'Aparência', 'Evento'])
    tab(pg, 'Abertura')
    ok('UX: abrir a seção Abertura mostra o convite fechado na prévia', count(pg, 'main [aria-label="Toque para abrir o convite"]') == 1 and 'Voltar às páginas' in text(pg))
    pg.click('button:has-text("Voltar às páginas")'); pg.wait_for_timeout(200)
    # revisão antes de publicar
    pg.click('[data-testid="publish-btn"]'); pg.wait_for_timeout(300)
    rv = pg.inner_text('[data-testid="review-list"]')
    ok('UX: revisão aponta texto de exemplo e fotos sem imagem', 'Textos do convite' in rv and 'fotos sem imagem' in rv and 'Data e horário' in rv, rv)
    ok('UX: revisão confirma local e prazo', 'Recafé' in rv and 'até ' in rv, rv)
    pg.click('[data-testid="review-list"] li:has-text("Textos do convite") button'); pg.wait_for_timeout(400)
    ok('UX: Corrigir leva ao bloco com texto de exemplo', count(pg, '[aria-labelledby="pub-title"]') == 0 and pg.input_value('#blk-text') == 'Escreva aqui.', pg.input_value('#blk-text') if count(pg, '#blk-text') else '')
    pg.fill('#blk-text', 'Com amor, Amanda e Flávio'); pg.wait_for_timeout(300)
    pg.click('[data-testid="ready-chip"]'); pg.wait_for_timeout(300)
    pg.click('[data-testid="review-list"] li:has-text("Textos do convite") button'); pg.wait_for_timeout(400)
    ok('UX: próximo texto de exemplo (orientações)', 'Outras orientações' in pg.input_value('#blk-text'), pg.input_value('#blk-text'))
    pg.fill('#blk-text', 'Traje: esporte fino\nEstacionamento no local'); pg.wait_for_timeout(1200)
    ok('UX: prontidão sobe ao corrigir', 'Pronto para publicar: 4 de 5' in pg.inner_text('[data-testid="ready-chip"]'), pg.inner_text('[data-testid="ready-chip"]'))
    publish(pg)
    # celular: editor com barra inferior
    m = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    mp = m.new_page(); mp.set_default_timeout(6000)
    mp.goto(BASE + '#/Main'); mp.wait_for_timeout(800)
    mp.fill('#user', 'admin'); mp.fill('#pw', PASSWORD); mp.keyboard.press('Enter'); mp.wait_for_timeout(1300)
    ok('Celular: menu compacto no topo', count(mp, '[aria-label="Abrir menu"]') == 1 and count(mp, 'nav[aria-label="Principal"]') == 0)
    mp.click('[aria-label="Abrir menu"]'); mp.wait_for_timeout(200)
    ok('Celular: menu abre com Convites, Temas, Usuários e Sair', all(t in mp.inner_text('[role=menu]') for t in ['Convites', 'Temas', 'Usuários', 'Sair']))
    mp.goto(BASE + '#/Editor/' + uid); mp.wait_for_timeout(2500)
    ok('Celular: editor com barra de ferramentas embaixo', count(mp, 'nav[aria-label="Ferramentas do editor"] button') == 4 and not mp.locator('aside[aria-label="Propriedades"]').is_visible())
    mp.click('nav[aria-label="Ferramentas do editor"] button:has-text("Evento")'); mp.wait_for_timeout(300)
    ok('Celular: Evento abre o painel por baixo', mp.locator('#ev-day').is_visible())
    mp.click('aside[aria-label="Propriedades"] button:has-text("Pronto")'); mp.wait_for_timeout(200)
    mp.click('nav[aria-label="Ferramentas do editor"] button:has-text("Páginas")'); mp.wait_for_timeout(300)
    ok('Celular: Páginas abre a lista de páginas', mp.locator('aside[aria-label="Páginas"]').is_visible())
    sw = mp.evaluate('document.documentElement.scrollWidth')
    ok('Celular: editor sem rolagem lateral', sw <= 392, sw)
    m.close()
    # convidado: link curto, aba Confirmar, deslizar, sucesso com rotas
    gctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    g = gctx.new_page(); g.set_default_timeout(6000)
    g.goto(BASE + 'c/' + uid); g.wait_for_timeout(1800)
    g.click('[aria-label="Toque para abrir o convite"]'); g.wait_for_timeout(3200)
    ok('Convidado: link curto /c/ abre o convite', count(g, 'h1:has-text("Vamos casar!")') == 1)
    ok('Convidado: dica de deslizar na capa', count(g, '[data-testid="swipe-hint"]') == 1)
    ok('Convidado: aba de presença vira "Confirmar"', count(g, '[data-rsvp-tab="1"]') == 1 and 'Confirmar' in g.inner_text('[data-rsvp-tab="1"]'))
    # deslizar de verdade (toques do aparelho): lento e curto volta; longo e lento troca de página
    cdp = gctx.new_cdp_session(g)
    def swipe(x0, x1, ms, y=420, shift=False):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x0, 'y': y}]})
        for i in range(1, 11):
            g.wait_for_timeout(ms // 10); cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x0 + (x1 - x0) * i / 10, 'y': y}]})
        moved = g.evaluate("() => getComputedStyle(document.querySelector('[data-testid=paginas] main')).translate") if shift else None
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); g.wait_for_timeout(700)
        return moved
    moved = swipe(330, 280, 600, shift=True)
    ok('Convidado: a página acompanha o dedo', moved not in (None, 'none', '0px'), moved)
    ok('Convidado: deslize curto não troca de página', count(g, 'h1:has-text("Vamos casar!")') == 1)
    swipe(330, 80, 1500)
    ok('Convidado: deslizar para o lado (mesmo devagar) vai à página seguinte', 'Quando e onde' in g.inner_text('body'))
    swipe(60, 330, 300)
    ok('Convidado: deslizar para a direita volta', count(g, 'h1:has-text("Vamos casar!")') == 1)
    swipe(60, 330, 300)
    ok('Convidado: na primeira página, deslizar para a direita não sai dela', count(g, 'h1:has-text("Vamos casar!")') == 1)
    ok('Convidado: no celular, sem setas ao lado', count(g, '[data-page-arrow]') == 0)
    swipe(330, 80, 250)
    ok('Convidado: deslize rápido vai à página seguinte', 'Quando e onde' in g.inner_text('body'))
    go_rsvp(g); g.wait_for_timeout(400)
    ok('Convidado: prazo no texto da página', 'Responda até ' in g.inner_text('body') and '{prazo}' not in g.inner_text('body'))
    g.fill('input[autocomplete=name]', 'Bia Teste'); g.click('button:has-text("Sim, eu vou")'); g.click('button:has-text("Enviar resposta")'); g.wait_for_timeout(1200)
    ok('Convidado: sucesso com agenda, rotas e alterar', all(t in g.inner_text('body') for t in ['Adicionar à agenda', 'Como chegar', 'Alterar minha resposta']))
    href = g.get_attribute('a:has-text("Como chegar")', 'href') or ''
    ok('Convidado: Como chegar usa o endereço', 'Mariana' in __import__('urllib.parse').parse.unquote(href), href)
    ok('Convidado: aba mostra ✓ depois de responder', count(g, '[data-rsvp-tab="1"]') == 0)
    gctx.close()
    # computador: setas ao lado do convite, teclado, arrastar com o mouse e trackpad
    dctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    d = dctx.new_page(); d.set_default_timeout(6000)
    d.goto(BASE + 'c/' + uid); d.wait_for_timeout(1800)
    d.click('[aria-label="Toque para abrir o convite"]'); d.wait_for_timeout(3200)
    first = lambda: count(d, 'h1:has-text("Vamos casar!")') == 1
    curtab = lambda: d.evaluate("() => (document.querySelector('nav[aria-label=\"Páginas do convite\"] [aria-current=page]') || {}).textContent.trim()")
    ok('Computador: setas ao lado do convite', count(d, '[data-page-arrow]') == 2 and d.locator('[data-page-arrow=prev]').is_disabled() and not d.locator('[data-page-arrow=next]').is_disabled())
    ok('Computador: dica fala em setas', 'setas' in (d.inner_text('[data-testid="swipe-hint"]') if count(d, '[data-testid="swipe-hint"]') else ''))
    t0 = curtab()
    d.click('[data-page-arrow=next]'); d.wait_for_timeout(500)
    t1 = curtab()
    ok('Computador: seta › vai à página seguinte', not first() and t1 != t0, [t0, t1])
    d.keyboard.press('ArrowLeft'); d.wait_for_timeout(500)
    ok('Computador: tecla ← volta', first())
    d.keyboard.press('ArrowRight'); d.wait_for_timeout(500)
    ok('Computador: tecla → avança', curtab() == t1)
    d.click('[data-page-arrow=prev]'); d.wait_for_timeout(500)
    bx = d.locator('[data-testid=paginas]').bounding_box(); cx, cy = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
    d.mouse.move(cx + 120, cy); d.mouse.down()
    for i in range(10): d.mouse.move(cx + 120 - 25 * i, cy + 2); d.wait_for_timeout(20)
    d.mouse.up(); d.wait_for_timeout(500)
    ok('Computador: arrastar com o mouse troca de página', curtab() == t1, curtab())
    for i in range(6): d.mouse.wheel(-40, 0); d.wait_for_timeout(16)
    d.wait_for_timeout(500)
    ok('Computador: deslizar no trackpad troca de página', first())
    dctx.close()
    # painel: resumo da resposta no cartão e na tela de convidados
    go(pg, 'Main', 1500)
    card = pg.inner_text('article:has-text("Casamento Amanda & Flávio")')
    ok('Painel: cartão conta a resposta recebida', '1 pessoa vai' in card, card)
    go(pg, 'Respostas/' + uid, 1500)
    ok('Convidados: resumo com 1 pessoa confirmada', pg.inner_text('[data-testid="sum-people"]') == '1')
    pg.click('button[role=tab]:has-text("Compartilhar")'); pg.wait_for_timeout(300)
    ok('Convidados: aba Compartilhar com link e mensagem', count(pg, '[data-testid="share-link"]') == 1 and count(pg, '#shr-msg') == 1)
    # criar tema em 3 passos
    go(pg, 'CriarTema', 1500)
    ok('Tema: começa no passo Cores', count(pg, '[data-testid="photo-palette"]') == 1 and count(pg, '#t-name') == 1)
    pg.set_input_files('#ct-photo', FIX + 'paisagem.jpg'); pg.wait_for_timeout(1200)
    ok('Tema: cores tiradas da foto', pg.input_value('#c-bg').lower() not in ('#1f3329', ''), pg.input_value('#c-bg'))
    pg.click('button:has-text("Próximo: Letras")'); pg.wait_for_timeout(300)
    ok('Tema: passo Letras', count(pg, '[data-testid="photo-palette"]') == 0 and 'Tipografia' in text(pg))
    pg.click('button:has-text("Próximo: Capa e abertura")'); pg.wait_for_timeout(300)
    ok('Tema: passo Capa e abertura', 'Layout da capa' in text(pg) and 'Animação de abertura' in text(pg))
    ok('Tema: prévia com o título do convite mais recente', count(pg, 'aside[aria-label="Prévia do tema"] >> text=Vamos casar!') >= 1)


def t_login_extras(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}); lp = ctx.new_page()
    lp.goto(BASE + '#/Main'); lp.wait_for_timeout(900)
    lp.click('button:has-text("Esqueci minha senha")'); lp.wait_for_timeout(200)
    ok('Login: "Esqueci minha senha" orienta a pedir ao administrador', count(lp, '[data-testid="forgot-help"]') == 1 and 'administrador' in lp.inner_text('[data-testid="forgot-help"]'))
    ctx.close()


def t_logout(pg):
    go(pg, 'Main', 1200)
    logout(pg); pg.wait_for_timeout(900)
    ok('Sair volta ao login', count(pg, '#pw') == 1)
    pg.fill('#user', 'admin'); pg.fill('#pw', PASSWORD); pg.click('button:has-text("Entrar")'); pg.wait_for_timeout(1000)


def t_mobile(pg):
    pg.set_viewport_size({'width': 390, 'height': 844})
    for r in ['Main', 'Temas', 'CriarTema', 'Respostas', 'Usuarios']:
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
                            ('trocar tema', t_change_theme, pg), ('tema próprio', t_custom_theme, pg), ('abertura', lambda: t_opening(pg, b), None), ('fotos', lambda: t_photos(pg, b), None), ('arrastar', lambda: t_dnd(pg, b), None), ('carregamento', lambda: t_loading(pg, b), None), ('faixas', t_tap_margin, b), ('animação', t_open_anim, b), ('personalizado', lambda: t_personal(pg, b), None), ('robustez', lambda: t_robust(pg, b), None), ('usuários', lambda: t_users(pg, b), None), ('cliente', lambda: t_client(pg, b), None), ('pedido', lambda: t_pedido(pg, b), None), ('segurança', lambda: t_security(pg, b), None), ('mídia', lambda: t_media_limits(pg, b), None), ('save the date', lambda: t_savedate(pg), None), ('backup', lambda: t_backup(pg, b), None), ('nova experiência', lambda: t_ux(pg, b), None), ('design', lambda: t_design(pg, b), None), ('login extra', t_login_extras, b), ('sair', t_logout, pg), ('celular', t_mobile, pg)]:
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
