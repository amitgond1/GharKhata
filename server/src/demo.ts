import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { User, Project, Membership, Vendor, Record, Audit } from './models.ts';
import { today } from '@gharkhata/shared';
export async function makeDemo() {
  return mongoose.connection.transaction(async (session) => {
    const [user] = await User.create(
      [
        {
          name: 'Aarav Sharma',
          email: `demo-${randomUUID()}@example.invalid`,
          password: 'disabled-demo-account',
          demo: true,
          language: 'en',
        },
      ],
      { session },
    );
    const yearMonth = today().slice(0, 7);
    const date = (day: number) => `${yearMonth}-${String(day).padStart(2, '0')}`;
    const [project] = await Project.create(
      [
        {
          owner: user._id,
          name: 'Sharma Residence',
          demo: true,
          data: {
            name: 'Sharma Residence',
            location: 'Indore, Madhya Pradesh',
            type: 'construction',
            floors: 2,
            startDate: `${today().slice(0, 4)}-04-01`,
            endDate: `${Number(today().slice(0, 4)) + 1}-03-31`,
            budget: 450000000,
            status: 'active',
            area: 2400,
            areaUnit: 'sq ft',
            timezone: 'Asia/Kolkata',
            threshold: 90,
            estimate: 180000000,
          },
        },
      ],
      { session },
    );
    await Membership.create([{ project: project._id, user: user._id, role: 'owner' }], { session });
    const vendors = await Vendor.create(
      [
        {
          name: 'Sharma Building Materials',
          type: 'supplier',
          business: 'Sharma Traders',
          phone: '',
          address: 'Fictional demo supplier',
        },
        {
          name: 'Ramesh Construction',
          type: 'contractor',
          business: 'Ramesh Construction',
          phone: '',
          address: 'Fictional demo contractor',
        },
        {
          name: 'Gupta Steel & Cement',
          type: 'supplier',
          business: 'Gupta Steel',
          phone: '',
          address: 'Fictional demo supplier',
        },
      ].map((data) => ({ project: project._id, data })),
      { session, ordered: true },
    );
    const add = async (kind: string, data: any) => {
      const [r] = await Record.create([{ project: project._id, createdBy: user._id, kind, data }], {
        session,
      });
      return String(r._id);
    };
    const entries = [
      ['Foundation & concrete work', 'Concrete', 68000000, 1, 'Foundation'],
      ['TMT steel · Fe 500', 'Steel', 42500000, 2, 'Ground-floor structure'],
      ['Masonry & brickwork', 'Bricks and blocks', 25800000, 0, 'Masonry'],
      ['Site preparation & excavation', 'Equipment rental', 13500000, 1, 'Site preparation'],
      ['Construction labour · September', 'Labour', 21500000, 1, 'Ground-floor structure'],
      ['River sand · 3 deliveries', 'Sand', 12400000, 0, 'Masonry'],
      ['Cement · 100 bags', 'Cement', 4000000, 2, 'Masonry'],
      ['Electrical conduit & wiring', 'Electrical', 1850000, 0, 'Electrical'],
    ];
    for (let i = 0; i < entries.length; i++) {
      const [description, category, total, vi, stage] = entries[i] as [
        string,
        string,
        number,
        number,
        string,
      ];
      const billDate =
        i < 5
          ? `${today().slice(0, 4)}-${String(Math.max(1, Number(today().slice(5, 7)) - 5 + i)).padStart(2, '0')}-12`
          : date(20 + i);
      const bill = await add('bill', {
        description,
        invoice: `DEMO-00${i + 1}`,
        vendor: String(vendors[vi]._id),
        date: billDate,
        dueDate: date(28),
        lines: [
          {
            description,
            category,
            quantity: '1',
            unit: 'Fixed amount',
            rate: total,
            total,
            discount: 0,
            tax: 0,
            transport: 0,
            other: 0,
          },
        ],
        total,
        stage,
        floor: i < 4 ? 'Ground floor' : 'First floor',
        notes: 'Fictional demo record',
        attachments: [],
      });
      const paid = i === 6 ? 2500000 : i === 7 ? 0 : total;
      if (paid) {
        const payment = await add('payment', {
          amount: paid,
          vendor: String(vendors[vi]._id),
          payee: vendors[vi].data.name,
          date: billDate,
          method: i % 2 ? 'UPI' : 'bank transfer',
          reference: `DEMO-P${i}`,
          notes: 'Fictional payment',
          attachments: [],
        });
        await add('allocation', { bill, payment, amount: paid, date: billDate });
      }
    }
    await add('payment', {
      amount: 1000000,
      vendor: String(vendors[0]._id),
      payee: vendors[0].data.name,
      date: date(26),
      method: 'UPI',
      reference: 'DEMO-ADVANCE',
      notes: 'Advance for next delivery',
      attachments: [],
    });
    await add('task', {
      title: 'Confirm first-floor slab delivery',
      dueDate: date(30),
      assignee: 'Aarav',
      priority: 'high',
      stage: 'Upper-floor structure',
      status: 'pending',
      checklist: [],
      attachments: [],
    });
    await add('task', {
      title: 'Review electrical points with contractor',
      dueDate: date(31).replace(/-31$/, '-28'),
      assignee: 'Aarav',
      priority: 'normal',
      stage: 'Electrical',
      status: 'in progress',
      checklist: [],
      attachments: [],
    });
    await add('task', {
      title: 'Approve ground-floor masonry',
      dueDate: date(24),
      assignee: 'Aarav',
      priority: 'normal',
      stage: 'Masonry',
      status: 'done',
      checklist: [],
      attachments: [],
    });
    await add('log', {
      date: date(26),
      title: 'Our first floor is taking shape',
      stage: 'Upper-floor structure',
      floor: 'First floor',
      notes: 'Column reinforcement completed. Shuttering work begins tomorrow.',
      problems: '',
      labourCount: 8,
      attachments: [],
      captions: [],
    });
    await add('log', {
      date: date(23),
      title: 'Ground-floor brickwork completed',
      stage: 'Masonry',
      floor: 'Ground floor',
      notes: 'All internal walls completed and openings checked with the plan.',
      problems: '',
      labourCount: 6,
      attachments: [],
      captions: [],
    });
    for (const [label, amount] of [
      ['Cement', 12000000],
      ['Steel', 50000000],
      ['Labour', 40000000],
      ['Concrete', 80000000],
    ] as const)
      await add('budget', { dimension: 'category', label, amount });
    await add('stock', {
      date: date(26),
      material: 'Cement',
      unit: 'Bag',
      type: 'received',
      quantity: '100',
      threshold: '20',
      notes: 'Demo stock receipt',
    });
    await add('stock', {
      date: date(27),
      material: 'Cement',
      unit: 'Bag',
      type: 'used',
      quantity: '35',
      threshold: '20',
      notes: 'Masonry work',
    });
    const worker = await add('worker', {
      name: 'Ramesh masonry team',
      trade: 'Masonry',
      phone: '',
      rate: 350000,
      vendor: String(vendors[1]._id),
    });
    await add('attendance', { date: date(27), worker, units: '1', rate: 350000, notes: '' });
    await Audit.create(
      [
        {
          project: project._id,
          user: user._id,
          action: 'demo.create',
          target: String(project._id),
          after: { note: 'Fictional demo project' },
        },
      ],
      { session },
    );
    return { user, project };
  });
}
