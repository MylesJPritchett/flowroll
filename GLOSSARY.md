# Flowroll

Flowroll maps a Brazilian Jiu-Jitsu practitioner's game: the situations they end up in, what they can do from each, and where that leads.

## Positions and States

**Position**:
A named arrangement of two people's bodies, such as Closed Guard or Mount, with two fixed Roles.
_Avoid_: Spot, place

**Role**:
One of a Position's two fixed sides. Most Positions use Top and Bottom; standing and takedown Positions use Attacker and Defender instead.
_Avoid_: Player, side A/B

**Condition**:
A detail one person has in a State, such as an underhook or a knee shield.
_Avoid_: Grip (a grip is one kind of Condition), detail

**Condition Group**:
A family of Conditions where a person can have at most one at a time, such as which leg position they hold.
_Avoid_: Category

**State**:
A Position together with the Conditions each Role has in it. Two States with the same Position and Conditions are the same State, whatever they're called.
_Avoid_: Situation, node

**Named State**:
A State given its own label, such as High Mount. The name is only a label and plays no part in what makes the State unique.
_Avoid_: Variant, sub-position

## Actions

**Action**:
Something one person does that moves from one State to another, such as a Sweep or a Hip Escape.
_Avoid_: Move, technique, transition

**Actor**:
The person performing an Action, whichever Role they're in.
_Avoid_: Player, user

**Opponent**:
The person who isn't the Actor in an Action.
_Avoid_: Partner, defender (Defender is a Role, not the other person in an Action)

**Finish**:
Where a sequence ends without reaching another State, such as Submitted.
_Avoid_: End state, result

## Graphs

**Graph**:
A canvas of States and Actions, which can branch. A user has a Main Graph plus any number of others.
_Avoid_: Map, tree, Flow (a Flow is a path through a Graph, not the Graph itself)

**Main Graph**:
A user's default Graph.
_Avoid_: Workspace, home graph

**Flow**:
A path through a Graph that alternates State, Action, State, usually in a straight line, and ends in a State or a Finish.
_Avoid_: Chain, sequence, combo

**Merged Graph**:
A Graph made by combining other Graphs so that identical States become one.
_Avoid_: Combined flow

## Taxonomy

**Official**:
A Position, Condition or Action that comes curated with Flowroll.
_Avoid_: Built-in, default

**User-created**:
A Position, Condition or Action that someone added. It's shared with every user, just like Official ones.
_Avoid_: Custom, private
