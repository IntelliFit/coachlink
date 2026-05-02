## 1RM 估算方法 (V0.1)

### 符号说明

* **BW**：自身体重（Body Weight）

* **L**：调整后附加负重（Load）

* **W**：总重量（Total Weight），即

  $$
  W = BW + L
  $$

* **r**：完成次数（Reps）

特别地，当用户输入的完成次数为 **1 次** 时，直接定义：

$$
\text{1RM} = BW + L
$$
---

## 综合 1RM 估算公式

### Epley

$$
\text{1RM}_{\text{Epley}} = W \times (1 + 0.0333 \times r)
$$
### Brzycki

$$
\text{1RM}_{\text{Brzycki}} = W \times \frac{36}{37 - r}
$$
## 最终综合估算（取二者平均值）

$$
\text{1RM}_{\text{final}}
=
\frac{
\text{1RM}_{\text{Epley}}
+
\text{1RM}_{\text{Brzycki}}
}{2}
$$
---

## 页面显示的“负重 1RM”

$$
\text{负重 1RM} = \text{1RM}_{\text{final}} - BW
$$
