import { FACTORIES, MACHINES, PRODUCTS } from '../hooks/useStore';

export function seedDemoData() {
  const entries = [];
  const production = [];
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  for (const factory of FACTORIES) {
    const machines = MACHINES[factory.id];
    for (const machine of machines) {
      for (let d = 0; d < 31; d++) {
        const date = new Date(startOfMonth);
        date.setDate(date.getDate() + d);
        if (date.getDay() === 0) continue;
        if (date.getMonth() !== startOfMonth.getMonth()) break;

        const product = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        const dailyProd = Math.round(machine.capacity * 0.8);
        const dateStr = date.toISOString().split('T')[0];

        entries.push({
          id: `${factory.id}-${machine.id}-${d}`,
          factory: factory.id, machine: machine.id, machineName: machine.name,
          product: product.id, productName: product.name,
          date: dateStr, planned: dailyProd, quality: 'A', side: 'Lado A',
        });

        if (date <= today) {
          const variance = 0.85 + Math.random() * 0.25;
          production.push({
            id: `prod-${factory.id}-${machine.id}-${d}`,
            planningId: `${factory.id}-${machine.id}-${d}`,
            factory: factory.id, machine: machine.id,
            product: product.id, productName: product.name,
            date: dateStr, actual: Math.round(dailyProd * variance),
            planned: dailyProd, source: 'demo',
          });
        }
      }
    }
  }
  return { entries, production };
}
