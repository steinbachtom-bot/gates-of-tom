"""
Moteur mathematique d'un slot "pay-anywhere" type Gates of Olympus.
- Grille 6 rouleaux x 5 lignes (30 cases)
- Gains "pay anywhere" : 8+ symboles identiques n'importe ou
- Tumble : les symboles gagnants disparaissent, les autres tombent, refill, re-evaluation
- Orbes multiplicateurs (Zeus) : x2 a x500, sommes et appliquees au gain
- Scatters : 4+ declenchent les free spins (multiplicateur persistant)
- RTP parametrable via les poids et taux ci-dessous

Tout est en multiples de la MISE TOTALE (mise = 1.0).
Ce fichier est un PROTOTYPE tunable, pas la math certifiee finale.
"""

import random

# ----------------------------------------------------------------------------
# CONFIGURATION (les "boutons" qui pilotent le RTP)
# ----------------------------------------------------------------------------

ROWS = 5
REELS = 6
CELLS = ROWS * REELS  # 30

# Symboles de paiement (du plus fort au plus faible) avec leur poids d'apparition.
# Plus le poids est eleve, plus le symbole sort souvent (donc gagne plus facilement).
SYMBOL_WEIGHTS = {
    "crown":      22.5,
    "hourglass":  25.0,
    "ring":       27.5,
    "chalice":    30.0,
    "gem_red":    32.5,
    "gem_purple": 35.0,
    "gem_yellow": 37.5,
    "gem_green":  40.0,
    "gem_blue":   42.5,
}

# Table de paiement : gain (x mise totale) selon le nombre de symboles.
# 3 paliers : 8-9, 10-11, 12+.
PAYTABLE = {
    "crown":      {"8-9": 10.0, "10-11": 25.0, "12+": 50.0},
    "hourglass":  {"8-9": 2.5,  "10-11": 10.0, "12+": 25.0},
    "ring":       {"8-9": 2.0,  "10-11": 5.0,  "12+": 15.0},
    "chalice":    {"8-9": 1.5,  "10-11": 2.0,  "12+": 12.0},
    "gem_red":    {"8-9": 1.0,  "10-11": 1.5,  "12+": 10.0},
    "gem_purple": {"8-9": 0.8,  "10-11": 1.2,  "12+": 8.0},
    "gem_yellow": {"8-9": 0.5,  "10-11": 1.0,  "12+": 6.0},
    "gem_green":  {"8-9": 0.4,  "10-11": 0.9,  "12+": 5.0},
    "gem_blue":   {"8-9": 0.25, "10-11": 0.75, "12+": 4.0},
}

# Scatter (Zeus) : poids d'apparition + gains directs (x mise) selon le nombre.
SCATTER_WEIGHT = 9
SCATTER_PAYS = {4: 3.0, 5: 5.0, 6: 100.0}  # 6+ regroupe ici
SCATTERS_TO_TRIGGER = 4
FREE_SPINS_AWARDED = 15
FREE_SPINS_RETRIGGER = 5  # +5 spins si 3+ scatters pendant les free spins

# Plafond de gain par round (x mise). Standard du marche : 5000x.
# Indispensable : limite la volatilite et rend le RTP controlable.
MAX_WIN = 5000.0

# Orbe multiplicateur : poids d'apparition + distribution des valeurs.
MULT_WEIGHT = 5
MULT_VALUES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100, 250, 500]
MULT_VALUE_WEIGHTS = [
    300, 250, 200, 160, 130, 90, 70, 50, 35, 22, 14, 6, 3, 1, 1
]

# ----------------------------------------------------------------------------
# Construction de la "roue" ponderee de tirage par case
# ----------------------------------------------------------------------------

_PAY_SYMBOLS = list(SYMBOL_WEIGHTS.keys())
_DRAW_POOL = _PAY_SYMBOLS + ["SCATTER", "MULT"]
_DRAW_WEIGHTS = (
    [SYMBOL_WEIGHTS[s] for s in _PAY_SYMBOLS] + [SCATTER_WEIGHT, MULT_WEIGHT]
)


def _draw_symbol(rng):
    return rng.choices(_DRAW_POOL, weights=_DRAW_WEIGHTS, k=1)[0]


def _draw_mult_value(rng):
    return rng.choices(MULT_VALUES, weights=MULT_VALUE_WEIGHTS, k=1)[0]


# Scaler global applique a TOUS les gains. Sert a regler le RTP au plus juste :
# le RTP est ~lineaire en fonction de ce facteur.
PAY_SCALE = 0.890


def _pay_for_count(symbol, count):
    if count < 8:
        return 0.0
    tier = "8-9" if count <= 9 else ("10-11" if count <= 11 else "12+")
    return PAYTABLE[symbol][tier] * PAY_SCALE


# ----------------------------------------------------------------------------
# Logique d'un "round" (un spin + toutes ses cascades)
# ----------------------------------------------------------------------------

def _new_cell(rng):
    """Retourne (type, valeur). type in pay-symbol | 'SCATTER' | 'MULT'."""
    s = _draw_symbol(rng)
    if s == "MULT":
        return ("MULT", _draw_mult_value(rng))
    return (s, 0)


# Tirage SANS scatter (contrainte "max 1 scatter par colonne").
_DRAW_POOL_NS = _PAY_SYMBOLS + ["MULT"]
_DRAW_WEIGHTS_NS = [SYMBOL_WEIGHTS[s] for s in _PAY_SYMBOLS] + [MULT_WEIGHT]


def _new_cell_no_scatter(rng):
    s = rng.choices(_DRAW_POOL_NS, weights=_DRAW_WEIGHTS_NS, k=1)[0]
    if s == "MULT":
        return ("MULT", _draw_mult_value(rng))
    return (s, 0)


def _fill_column(rng, kept, need):
    """`need` nouvelles cases pour une colonne, AU PLUS 1 scatter par colonne
    (kept = cases conservées, peut déjà contenir un scatter)."""
    has_scatter = any(t == "SCATTER" for (t, _v) in kept)
    out = []
    for _ in range(need):
        cell = _new_cell(rng)
        if cell[0] == "SCATTER":
            if has_scatter:
                cell = _new_cell_no_scatter(rng)
            else:
                has_scatter = True
        out.append(cell)
    return out


def _idx(c, r):
    return c * ROWS + r


def play_round(rng):
    """
    Joue un round complet (base ou free spin) et retourne un dict :
    base_win   : gain des symboles avant multiplicateurs (x mise)
    mult_sum   : somme des orbes presents a la fin (0 si aucun)
    scatters   : nombre de scatters apparus
    """
    # Remplissage initial colonne par colonne (max 1 scatter par colonne)
    grid = [None] * CELLS
    for c in range(REELS):
        col = _fill_column(rng, [], ROWS)
        for r in range(ROWS):
            grid[_idx(c, r)] = col[r]

    base_win = 0.0

    while True:
        # Compter les symboles de paiement
        counts = {}
        for (t, _v) in grid:
            if t in SYMBOL_WEIGHTS:
                counts[t] = counts.get(t, 0) + 1

        step_win = 0.0
        winning_symbols = set()
        for sym, cnt in counts.items():
            pay = _pay_for_count(sym, cnt)
            if pay > 0:
                step_win += pay
                winning_symbols.add(sym)

        if step_win <= 0:
            break

        base_win += step_win

        # Tumble colonne par colonne : les gagnants tombent, scatters/orbes restent.
        new_grid = list(grid)
        for c in range(REELS):
            kept = [grid[_idx(c, r)] for r in range(ROWS)
                    if grid[_idx(c, r)][0] not in winning_symbols]
            need = ROWS - len(kept)
            col = _fill_column(rng, kept, need) + kept  # nouvelles cases en haut
            for r in range(ROWS):
                new_grid[_idx(c, r)] = col[r]
        grid = new_grid

    # Scatters et orbes presents sur la grille finale (scatters jamais retires).
    scatters_seen = sum(1 for (t, _v) in grid if t == "SCATTER")
    mult_sum = sum(v for (t, v) in grid if t == "MULT")

    return {
        "base_win": base_win,
        "mult_sum": mult_sum,
        "scatters": min(scatters_seen, 6),
    }


def play_base_spin(rng):
    """Un spin de base. Retourne (gain_total_x_mise, declenche_free_spins, nb_scatters)."""
    r = play_round(rng)
    win = r["base_win"]
    if win > 0 and r["mult_sum"] > 0:
        win *= r["mult_sum"]

    # Gain direct des scatters
    sc = r["scatters"]
    if sc >= 6:
        win += SCATTER_PAYS[6] * PAY_SCALE
    elif sc in SCATTER_PAYS:
        win += SCATTER_PAYS[sc] * PAY_SCALE

    trigger = sc >= SCATTERS_TO_TRIGGER
    if win > MAX_WIN:
        win = MAX_WIN
    return win, trigger, sc


def play_free_spins(rng):
    """
    Session de free spins avec multiplicateur PERSISTANT
    (toutes les valeurs d'orbes s'additionnent pour le reste de la session).
    Retourne le gain total de la session (x mise).
    """
    spins_left = FREE_SPINS_AWARDED
    persistent_mult = 0
    total = 0.0

    while spins_left > 0:
        spins_left -= 1
        r = play_round(rng)
        # Les orbes du spin s'ajoutent au multiplicateur persistant
        persistent_mult += r["mult_sum"]
        win = r["base_win"]
        if win > 0:
            win *= persistent_mult if persistent_mult > 0 else 1
        total += win
        # Gains directs scatter pendant les FS
        sc = r["scatters"]
        if sc >= 6:
            total += SCATTER_PAYS[6] * PAY_SCALE
        elif sc in SCATTER_PAYS:
            total += SCATTER_PAYS[sc] * PAY_SCALE
        # Retrigger
        if sc >= 3:
            spins_left += FREE_SPINS_RETRIGGER
        if total >= MAX_WIN:
            total = MAX_WIN
            break

    return total


def play_bet(rng):
    """
    Un pari complet : spin de base + free spins eventuels.
    Le plafond MAX_WIN (5000x) s'applique au TOTAL du pari (base + feature),
    standard du marche. C'est la fonction qui fait foi pour le RTP.
    Retourne (gain_total_x_mise, declenche_free_spins, nb_scatters).
    """
    win, trigger, sc = play_base_spin(rng)   # base deja plafonnee a MAX_WIN
    if trigger:
        win += play_free_spins(rng)          # FS deja plafonnees a MAX_WIN
        if win > MAX_WIN:                     # plafond COMBINE base+FS
            win = MAX_WIN
    return win, trigger, sc
