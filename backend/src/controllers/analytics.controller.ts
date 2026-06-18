import { Response } from 'express';
import prisma from '../config/database';
import { AuthRequest } from '../types';

// 대시보드 종합 통계
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      todaySales,
      monthSales,
      lastMonthSales,
      totalOrders,
      pendingOrders,
      totalProducts,
      todayImpressions,
      monthImpressions,
      recentOrders,
      topProducts,
    ] = await Promise.all([
      // 오늘 매출
      prisma.order.aggregate({
        where: { storeId: store.id, createdAt: { gte: todayStart }, status: { notIn: ['PENDING', 'CANCELLED', 'REFUNDED'] } },
        _sum: { finalAmount: true },
        _count: true,
      }),
      // 이번달 매출
      prisma.order.aggregate({
        where: { storeId: store.id, createdAt: { gte: monthStart }, status: { notIn: ['PENDING', 'CANCELLED', 'REFUNDED'] } },
        _sum: { finalAmount: true },
        _count: true,
      }),
      // 지난달 매출
      prisma.order.aggregate({
        where: {
          storeId: store.id,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
          status: { notIn: ['PENDING', 'CANCELLED', 'REFUNDED'] },
        },
        _sum: { finalAmount: true },
      }),
      // 전체 주문수 (결제 완료된 것만)
      prisma.order.count({ where: { storeId: store.id, status: { not: 'PENDING' } } }),
      // 처리 대기 주문 (CONFIRMED만 - 결제 완료 후 처리 대기)
      prisma.order.count({ where: { storeId: store.id, status: 'CONFIRMED' } }),
      // 활성 상품수
      prisma.product.count({ where: { storeId: store.id, isActive: true } }),
      // 오늘 노출수
      prisma.productImpression.count({
        where: { product: { storeId: store.id }, viewedAt: { gte: todayStart } },
      }),
      // 이번달 노출수
      prisma.productImpression.count({
        where: { product: { storeId: store.id }, viewedAt: { gte: monthStart } },
      }),
      // 최근 주문 5건 (결제 완료된 것만)
      prisma.order.findMany({
        where: { storeId: store.id, status: { not: 'PENDING' } },
        include: { items: { take: 1, include: { product: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // 인기 상품 Top 5
      prisma.product.findMany({
        where: { storeId: store.id, isActive: true },
        orderBy: { totalSales: 'desc' },
        take: 5,
        select: { id: true, name: true, thumbnail: true, totalSales: true, totalRevenue: true, totalViews: true },
      }),
    ]);

    const monthGrowth = lastMonthSales._sum.finalAmount
      ? (((monthSales._sum.finalAmount || 0) - lastMonthSales._sum.finalAmount) / lastMonthSales._sum.finalAmount) * 100
      : 0;

    res.json({
      success: true,
      data: {
        today: {
          sales: todaySales._sum.finalAmount || 0,
          orders: todaySales._count,
          impressions: todayImpressions,
        },
        month: {
          sales: monthSales._sum.finalAmount || 0,
          orders: monthSales._count,
          impressions: monthImpressions,
          growth: Math.round(monthGrowth * 10) / 10,
        },
        totals: {
          orders: totalOrders,
          pendingOrders,
          products: totalProducts,
          storeViews: store.totalViews,
        },
        recentOrders,
        topProducts,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: '통계 조회 중 오류가 발생했습니다.' });
  }
};

// 매출 차트 데이터 (일별)
export const getSalesChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const period = (req.query.period as string) || '30';
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const orders = await prisma.order.findMany({
      where: {
        storeId: store.id,
        createdAt: { gte: startDate },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: { createdAt: true, finalAmount: true },
    });

    // 일별 집계
    const dailyMap = new Map<string, { sales: number; orders: number }>();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dailyMap.set(key, { sales: 0, orders: 0 });
    }

    orders.forEach((order) => {
      const key = order.createdAt.toISOString().split('T')[0];
      if (dailyMap.has(key)) {
        const current = dailyMap.get(key)!;
        dailyMap.set(key, {
          sales: current.sales + order.finalAmount,
          orders: current.orders + 1,
        });
      }
    });

    const chartData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      sales: data.sales,
      orders: data.orders,
    }));

    res.json({ success: true, data: chartData });
  } catch {
    res.status(500).json({ success: false, error: '차트 데이터 조회 중 오류가 발생했습니다.' });
  }
};

// 상품별 노출/판매 분석
export const getProductAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const period = (req.query.period as string) || '30';
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const products = await prisma.product.findMany({
      where: { storeId: store.id, isActive: true },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        price: true,
        totalSales: true,
        totalRevenue: true,
        totalViews: true,
        _count: {
          select: {
            impressions: true,
            reviews: true,
          },
        },
      },
      orderBy: { totalViews: 'desc' },
      take: 20,
    });

    // 기간 내 노출수 조회
    const impressionCounts = await prisma.productImpression.groupBy({
      by: ['productId'],
      where: {
        product: { storeId: store.id },
        viewedAt: { gte: startDate },
      },
      _count: true,
    });

    const impressionMap = new Map(impressionCounts.map((i) => [i.productId, i._count]));

    const analytics = products.map((p) => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      price: p.price,
      periodImpressions: impressionMap.get(p.id) || 0,
      totalViews: p.totalViews,
      totalSales: p.totalSales,
      totalRevenue: p.totalRevenue,
      reviewCount: p._count.reviews,
      conversionRate:
        (impressionMap.get(p.id) || 0) > 0
          ? ((p.totalSales / (impressionMap.get(p.id) || 1)) * 100).toFixed(1)
          : '0',
    }));

    res.json({ success: true, data: analytics });
  } catch {
    res.status(500).json({ success: false, error: '상품 분석 조회 중 오류가 발생했습니다.' });
  }
};

// 정산 내역
export const getSettlements = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const store = await prisma.store.findUnique({ where: { sellerId: req.seller!.id } });
    if (!store) {
      res.status(404).json({ success: false, error: '스토어가 존재하지 않습니다.' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 12;

    const [settlements, total] = await Promise.all([
      prisma.settlement.findMany({
        where: { storeId: store.id },
        orderBy: { period: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.settlement.count({ where: { storeId: store.id } }),
    ]);

    res.json({
      success: true,
      data: settlements,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch {
    res.status(500).json({ success: false, error: '정산 내역 조회 중 오류가 발생했습니다.' });
  }
};

// 알림 목록
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { sellerId: req.seller!.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const unreadCount = await prisma.notification.count({
      where: { sellerId: req.seller!.id, isRead: false },
    });

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch {
    res.status(500).json({ success: false, error: '알림 조회 중 오류가 발생했습니다.' });
  }
};

// 알림 읽음 처리
export const markNotificationsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await prisma.notification.updateMany({
      where: { sellerId: req.seller!.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '알림 처리 중 오류가 발생했습니다.' });
  }
};
