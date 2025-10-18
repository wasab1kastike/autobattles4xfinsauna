# Policy Arsenal

## Access & Layout

Open the policies console from the HUD navigation toolbar’s Policies badge. The nav button now launches a dedicated glassmorphic sheet that slides in over the command console while dimming and inerting the underlying HUD. The window carries its own close control in the header, locks keyboard focus inside the sheet, and restores focus to the toolbar trigger when dismissed so players can fluidly bounce between roster management and doctrine planning. A live status badge in the header surfaces council alerts or policy updates without returning to the right-panel views.

## Battle Rhythm Doctrine
- **Prerequisite:** Aurora Temperance Treaty
- **Effect:** Multiplies attack damage by 1.15, slightly extends movement range, and grants a modest +5% hit bonus while nudging upkeep 10% higher.
- **Tactics:** Keep squads in tight formation with metronomic drills that amplify frontline tempo without torching your reserves.

## Saunojas' Rage Protocol
- **Prerequisite:** Battle Rhythm Doctrine
- **Effect:** Doubles damage dealt, applies a -50% hit reliability penalty, and layers on a 40% upkeep surcharge for every deployed unit.
- **Tactics:** Toggle when you need a berserker crescendo—pair with accuracy buffs or shielded initiators so the reckless swings still convert into kills.

## Glacial Gambit Targeting Program
- **Prerequisite:** Battle Rhythm Doctrine & Steam Diplomats Accord
- **Effect:** Adds 35% attack range, pumps a +30% accuracy bonus into the roster, trims defense by 20%, multiplies incoming damage by 1.5×, and increases upkeep by 15%.
- **Tactics:** Ideal for glass-cannon volley teams—layer with command auras or shield specialists so the frosted marksmen delete threats before retaliatory strikes land.

## Shieldwall Doctrine
- **Prerequisite:** Battle Rhythm Doctrine
- **Effect:** Adds 30% defense, reduces incoming damage by 15%, and charges a flat +1.5 upkeep per unit to keep the barrier menders funded.
- **Tactics:** Anchor sieges behind condensed steam bulwarks to blunt counterattacks before unleashing your follow-up salvos.

## Sauna Skin Plating
- **Prerequisite:** Shieldwall Doctrine
- **Effect:** Halves damage taken for roster units while tripling upkeep costs via the shared policy modifier pipeline.
- **Tactics:** A high-risk, premium defensive toggle for emergency turtling or elite vanguard deployments. Pair with Shieldwall Doctrine to reach extreme damage mitigation but ensure your economy can sustain the upkeep surge.

The policy console updates in real time through `recalculatePolicyModifiers`, keeping roster stats and upkeep drains synchronized whenever you toggle these doctrines.

## Steam Debt Protocol
- **Prerequisite:** Steam Diplomats Accord
- **Effect:** Adds +3 passive Sauna Beer production, dials enemy aggression up 25%,
  and increases cadence by 15% while layering a 12% upkeep multiplier. Revoking
  the toggle restores the previous values immediately.
- **Tactics:** Deploy when you need luxe resource injections to cover rush
  spending—just brace the roster for fiercer pressure and higher upkeep until you
  settle the bonds.
