/**
 * Scripted answers for the Phase 1 mock tutor. These preview the real answer shapes
 * (soul.md §3). Every number here is worked out correctly; nothing pretends to come
 * from a real textbook; the "Demo textbook" is labelled as such.
 */
import { offTopicRedirect } from "@/shared/redirects";
import type { RouteInfo, Source } from "@/shared/ui-message";

export { offTopicRedirect };

export interface MockScript {
  id: "numerical" | "derivation" | "concept" | "textbook" | "off_topic" | "preview";
  route: RouteInfo;
  reasoning?: string;
  sources?: Source[];
  text: string;
}

export const NUMERICAL_PROJECTILE = String.raw`**Given**
- Initial speed: $v_0 = 20\ \text{m/s}$
- Launch angle: $\theta = 30^\circ$ above the horizontal
- Gravitational acceleration: $g = 9.8\ \text{m/s}^2$
- Launch and landing at the same height; air resistance neglected

**Find**
- The horizontal range $R$

**Concepts**
The horizontal and vertical motions are independent. Horizontally there is no acceleration; vertically the acceleration is $-g$.

**Equations**

$$
x(t) = v_0\cos\theta\,t, \qquad y(t) = v_0\sin\theta\,t - \tfrac{1}{2} g t^2
$$

**Solution**

1. The projectile lands when $y(T) = 0$ with $T > 0$:

$$
T = \frac{2 v_0 \sin\theta}{g}
$$

2. The range is the horizontal distance covered in that time:

$$
R = v_0\cos\theta \cdot T = \frac{v_0^2 \sin 2\theta}{g}
$$

3. Substitute the numbers, keeping the units:

$$
R = \frac{(20\ \text{m/s})^2 \,\sin 60^\circ}{9.8\ \text{m/s}^2} = \frac{400\ \text{m}^2/\text{s}^2 \times 0.866}{9.8\ \text{m/s}^2}
$$

**Result**

$$
\boxed{R \approx 35.3\ \text{m}}
$$

**Check**
- Units: $\dfrac{\text{m}^2/\text{s}^2}{\text{m/s}^2} = \text{m}$ ✓
- Limiting case: the maximum range (at $\theta = 45^\circ$) is $v_0^2/g \approx 40.8\ \text{m}$, so $35.3\ \text{m}$ at $30^\circ$ is sensible ✓
- Flight time $T \approx 2.04\ \text{s}$ and horizontal speed $v_0\cos\theta \approx 17.3\ \text{m/s}$ give $17.3 \times 2.04 \approx 35.3\ \text{m}$ ✓`;

export const DERIVATION_PENDULUM = String.raw`**Starting point.** A bob of mass $m$ hangs from a light, rigid rod of length $L$. Let $\theta$ be the angle from the vertical.

1. Only the component of gravity along the arc restores the bob (the rod's tension is perpendicular to the motion):

$$
F_t = -mg\sin\theta
$$

2. The arc length is $s = L\theta$, so the tangential acceleration is $a_t = L\ddot{\theta}$. Newton's second law along the arc gives:

$$
mL\ddot{\theta} = -mg\sin\theta
$$

3. For small angles ($\theta \lesssim 10^\circ$, in radians) $\sin\theta \approx \theta$, with an error below about $0.5\%$:

$$
\ddot{\theta} + \frac{g}{L}\,\theta = 0
$$

4. This is simple harmonic motion with angular frequency $\omega$:

$$
\theta(t) = \theta_0\cos(\omega t + \phi), \qquad \omega = \sqrt{\frac{g}{L}}
$$

5. The period is $T = 2\pi/\omega$:

$$
\boxed{T = 2\pi\sqrt{\frac{L}{g}}}
$$

**Physical meaning.** For small swings the period depends only on the length and on $g$, not on the mass or the amplitude. A $1.00\ \text{m}$ pendulum on Earth has $T \approx 2.01\ \text{s}$.`;

export const CONCEPT_NEWTON2 = String.raw`**In one sentence:** the net force on an object equals its mass times its acceleration, $\vec{F}_{\text{net}} = m\vec{a}$.

**Intuition.** Push an empty shopping trolley and it speeds up quickly; push a full one with the same force and it barely accelerates. Mass measures how strongly an object resists changes in its motion (its *inertia*).

**The physics.**

$$
\vec{F}_{\text{net}} = \sum_i \vec{F}_i = m\vec{a} = \frac{d\vec{p}}{dt}
$$

where $\vec{F}_{\text{net}}$ is the vector sum of all forces (newtons, $\text{N}$), $m$ is the mass ($\text{kg}$), $\vec{a}$ is the acceleration ($\text{m/s}^2$) and $\vec{p} = m\vec{v}$ is the momentum ($\text{kg·m/s}$). One newton is defined as $1\ \text{N} = 1\ \text{kg·m/s}^2$.

**Where it applies, and where it breaks down.**
- Holds in inertial (non-accelerating) frames.
- For systems whose mass changes (rockets), use $\vec{F}_{\text{net}} = d\vec{p}/dt$.
- Fails at speeds close to $c$ (use special relativity) and at atomic scales (use quantum mechanics).`;

export const TEXTBOOK_PROJECTILE = String.raw`**From your textbook**

Your textbook treats the horizontal and vertical motions of a projectile as independent, each governed by its own one-dimensional equations [1]. It then combines them to obtain the range on level ground [2]:

$$
R = \frac{v_0^2 \sin 2\theta_0}{g}
$$

**General explanation**

The range is largest at $\theta_0 = 45^\circ$ because $\sin 2\theta_0$ peaks at $1$ there. Complementary angles such as $30^\circ$ and $60^\circ$ give the same range, although the steeper launch stays in the air longer. With air resistance the optimum angle drops below $45^\circ$.`;

const DEMO_SOURCES: Source[] = [
  {
    label: 1,
    documentId: "demo-mechanics",
    title: "Demo textbook: Mechanics (sample data)",
    section: "4.3 Projectile Motion",
    pageStart: 71,
    pageEnd: 71,
    quote:
      "The key to analysing two-dimensional projectile motion is to break it into two motions: one along the horizontal axis and the other along the vertical.",
  },
  {
    label: 2,
    documentId: "demo-mechanics",
    title: "Demo textbook: Mechanics (sample data)",
    section: "4.3 Projectile Motion",
    pageStart: 73,
    pageEnd: 74,
    quote: "For a projectile launched and landing at the same height, the range is R = v₀² sin 2θ₀ / g.",
  },
];

export const PREVIEW_NOTICE = String.raw`**Preview mode.** The live tutor connects in the next build phase, so I can't answer this particular question yet, and I won't make something up.

Here's how answers will look. Try one of these sample questions to see a full worked answer:
- *What is Newton's second law?*
- *A ball is thrown at 20 m/s at 30° above the horizontal. Find its range.*
- *Derive the period of a simple pendulum.*

For a taste of the maths rendering: kinetic energy is $K = \tfrac{1}{2}mv^2$, and the work-energy theorem says

$$
W_{\text{net}} = \Delta K
$$`;

const OFF_TOPIC =
  /\b(recipe|biryani|cook|cricket|football|soccer|match|celebrity|stock tips?|crypto|poem|song lyrics|python|scraper|javascript|weather tomorrow)\b|ignore (all|your|previous) (rules|instructions)/i;

/** Mock router: picks a script from keywords (the real router is an LLM call in Phase 2). */
export function pickScript(question: string): MockScript {
  const q = question.toLowerCase();
  if (OFF_TOPIC.test(q)) {
    return {
      id: "off_topic",
      route: { scope: "off_topic", queryType: "concept", usingTextbook: false },
      text: offTopicRedirect(question),
    };
  }
  if (/\b(textbook|my book|chapter|pdf|the book)\b/.test(q)) {
    return {
      id: "textbook",
      route: { scope: "physics", queryType: "mixed", usingTextbook: true },
      reasoning:
        "The learner refers to their textbook. Use the retrieved passages on projectile motion, cite them, and add general context separately.",
      sources: DEMO_SOURCES,
      text: TEXTBOOK_PROJECTILE,
    };
  }
  if (/\b(range|thrown|launch|projectile)\b/.test(q) && /\d/.test(q)) {
    return {
      id: "numerical",
      route: { scope: "physics", queryType: "numerical", usingTextbook: false },
      reasoning:
        "Projectile on level ground, no drag. Split into horizontal and vertical motion. Flight time from y(T) = 0, then R = v0² sin2θ / g. sin60° ≈ 0.866, so R ≈ 400 × 0.866 / 9.8 ≈ 35.3 m. Check units and compare with the 45° maximum.",
      text: NUMERICAL_PROJECTILE,
    };
  }
  if (/\b(derive|derivation|pendulum)\b/.test(q)) {
    return {
      id: "derivation",
      route: { scope: "physics", queryType: "derivation", usingTextbook: false },
      reasoning:
        "Newton's second law along the arc, small-angle approximation, recognise SHM, then T = 2π/ω.",
      text: DERIVATION_PENDULUM,
    };
  }
  if (/newton'?s? (second|2nd) law|f\s*=\s*ma/.test(q)) {
    return {
      id: "concept",
      route: { scope: "physics", queryType: "concept", usingTextbook: false },
      text: CONCEPT_NEWTON2,
    };
  }
  return {
    id: "preview",
    route: { scope: "physics", queryType: "concept", usingTextbook: false },
    text: PREVIEW_NOTICE,
  };
}
