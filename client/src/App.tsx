
import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/utils/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, Users, Bed, CreditCard, Bell, Settings, User, Home, BookOpen, Percent, DollarSign, BarChart3 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import type { 
  RoomType, 
  Booking, 
  CreateBookingInput, 
  User as UserType, 
  CreateUserInput, 
  LoginInput, 
  CreatePaymentInput, 
  Notification, 
  PromoOffer, 
  CreatePromoOfferInput,
  CreateRoomTypeInput,
  roomTypeEnum,
  paymentMethodEnum
} from '../../server/src/schema';

interface DashboardStats {
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  pendingPayments: number;
}

function App() {
  // Authentication state
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState('search');

  // Search state
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [searchParams, setSearchParams] = useState({
    checkIn: addDays(new Date(), 1),
    checkOut: addDays(new Date(), 3),
    guests: 2,
    roomType: ''
  });
  const [availableRooms, setAvailableRooms] = useState<RoomType[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Booking state
  const [userBookings, setUserBookings] = useState<Booking[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<RoomType | null>(null);
  const [bookingForm, setBookingForm] = useState({
    specialRequests: ''
  });
  const [isBooking, setIsBooking] = useState(false);

  // Payment state
  const [selectedPayment, setSelectedPayment] = useState<'credit_card' | 'bank_transfer' | 'paypal' | 'e_wallet' | 'cash_on_arrival'>('credit_card');
  const [paymentForm, setPaymentForm] = useState({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardName: ''
  });

  // Admin state
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [promoOffers, setPromoOffers] = useState<PromoOffer[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Forms state
  const [loginForm, setLoginForm] = useState<LoginInput>({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<CreateUserInput>({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    phone: null,
    role: 'guest'
  });
  const [roomTypeForm, setRoomTypeForm] = useState<CreateRoomTypeInput>({
    name: '',
    type: 'deluxe',
    description: null,
    base_price: 0,
    max_occupancy: 2,
    amenities: [],
    image_urls: [],
    is_active: true
  });
  const [promoForm, setPromoForm] = useState<CreatePromoOfferInput>({
    code: '',
    name: '',
    description: null,
    discount_type: 'percentage',
    discount_value: 10,
    min_booking_amount: null,
    max_discount: null,
    valid_from: new Date(),
    valid_until: addDays(new Date(), 30),
    usage_limit: null,
    is_active: true
  });
  const [newAmenity, setNewAmenity] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  // Load initial data
  const loadRoomTypes = useCallback(async () => {
    try {
      const result = await trpc.getRoomTypes.query();
      setRoomTypes(result);
    } catch (error) {
      console.error('Failed to load room types:', error);
    }
  }, []);

  const loadUserBookings = useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await trpc.getBookingsByUser.query(currentUser.id);
      setUserBookings(result);
    } catch (error) {
      console.error('Failed to load user bookings:', error);
    }
  }, [currentUser]);

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const result = await trpc.getNotificationsByUser.query(currentUser.id);
      setNotifications(result);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [currentUser]);

  const loadAdminData = useCallback(async () => {
    if (!currentUser || currentUser.role === 'guest') return;
    try {
      const [bookingsResult, promosResult, statsResult] = await Promise.all([
        trpc.getBookings.query(),
        trpc.getPromoOffers.query(),
        trpc.getDashboardStats.query()
      ]);
      setAllBookings(bookingsResult);
      setPromoOffers(promosResult);
      setDashboardStats(statsResult);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadRoomTypes();
  }, [loadRoomTypes]);

  useEffect(() => {
    if (currentUser) {
      loadUserBookings();
      loadNotifications();
      loadAdminData();
    }
  }, [currentUser, loadUserBookings, loadNotifications, loadAdminData]);

  // Authentication handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await trpc.loginUser.mutate(loginForm);
      if (response?.user) {
        setCurrentUser(response.user);
        setShowLogin(false);
        setActiveTab('bookings');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await trpc.createUser.mutate(registerForm);
      if (response) {
        setCurrentUser(response);
        setShowRegister(false);
        setActiveTab('bookings');
      }
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('search');
  };

  // Search handlers
  const handleSearch = async () => {
    setIsSearching(true);
    try {
      const roomTypeFilter = searchParams.roomType as typeof roomTypeEnum._type | undefined;
      const result = await trpc.searchAvailableRooms.query({
        check_in_date: searchParams.checkIn,
        check_out_date: searchParams.checkOut,
        guests: searchParams.guests,
        room_type: roomTypeFilter
      });
      setAvailableRooms(result);
    } catch (error) {
      console.error('Search failed:', error);
      // Use room types as fallback since search is a stub
      setAvailableRooms(roomTypes);
    } finally {
      setIsSearching(false);
    }
  };

  // Booking handlers
  const handleBookRoom = async (roomType: RoomType) => {
    if (!currentUser) {
      setShowLogin(true);
      return;
    }
    setSelectedRoom(roomType);
  };

  const handleCreateBooking = async () => {
    if (!selectedRoom || !currentUser) return;
    
    setIsBooking(true);
    try {
      const bookingInput: CreateBookingInput = {
        user_id: currentUser.id,
        room_type_id: selectedRoom.id,
        check_in_date: searchParams.checkIn,
        check_out_date: searchParams.checkOut,
        guests: searchParams.guests,
        special_requests: bookingForm.specialRequests || null
      };

      const booking = await trpc.createBooking.mutate(bookingInput);
      
      // Create payment
      const nights = Math.ceil((searchParams.checkOut.getTime() - searchParams.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const totalAmount = selectedRoom.base_price * nights;
      
      const paymentInput: CreatePaymentInput = {
        booking_id: booking.id,
        amount: totalAmount,
        payment_method: selectedPayment,
        payment_details: selectedPayment === 'credit_card' ? paymentForm : null
      };

      await trpc.createPayment.mutate(paymentInput);
      
      // Send confirmation notification
      await trpc.sendBookingConfirmation.mutate(booking.id);
      
      // Refresh bookings
      await loadUserBookings();
      await loadNotifications();
      
      setSelectedRoom(null);
      setBookingForm({ specialRequests: '' });
      setActiveTab('bookings');
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setIsBooking(false);
    }
  };

  // Admin handlers
  const handleCreateRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createRoomType.mutate(roomTypeForm);
      await loadRoomTypes();
      setRoomTypeForm({
        name: '',
        type: 'deluxe',
        description: null,
        base_price: 0,
        max_occupancy: 2,
        amenities: [],
        image_urls: [],
        is_active: true
      });
    } catch (error) {
      console.error('Failed to create room type:', error);
    }
  };

  const handleCreatePromoOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createPromoOffer.mutate(promoForm);
      await loadAdminData();
      setPromoForm({
        code: '',
        name: '',
        description: null,
        discount_type: 'percentage',
        discount_value: 10,
        min_booking_amount: null,
        max_discount: null,
        valid_from: new Date(),
        valid_until: addDays(new Date(), 30),
        usage_limit: null,
        is_active: true
      });
    } catch (error) {
      console.error('Failed to create promo offer:', error);
    }
  };

  const addAmenity = () => {
    if (newAmenity.trim()) {
      setRoomTypeForm(prev => ({
        ...prev,
        amenities: [...prev.amenities, newAmenity.trim()]
      }));
      setNewAmenity('');
    }
  };

  const removeAmenity = (index: number) => {
    setRoomTypeForm(prev => ({
      ...prev,
      amenities: prev.amenities.filter((_, i) => i !== index)
    }));
  };

  const addImageUrl = () => {
    if (newImageUrl.trim()) {
      setRoomTypeForm(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, newImageUrl.trim()]
      }));
      setNewImageUrl('');
    }
  };

  const removeImageUrl = (index: number) => {
    setRoomTypeForm(prev => ({
      ...prev,
      image_urls: prev.image_urls.filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Home className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">🏨 Hotel Toyo Purwokerto</h1>
                <p className="text-sm text-gray-600">Experience Luxury & Comfort</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {currentUser ? (
                <>
                  <div className="relative">
                    <Bell className="h-5 w-5 text-gray-600" />
                    {notifications.filter(n => n.status === 'pending').length > 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium">{currentUser.first_name} {currentUser.last_name}</span>
                    <Badge variant={currentUser.role === 'superuser' ? 'default' : 'secondary'}>
                      {currentUser.role}
                    </Badge>
                  </div>
                  <Button onClick={handleLogout} variant="outline" size="sm">
                    Logout
                  </Button>
                </>
              ) : (
                <div className="space-x-2">
                  <Dialog open={showLogin} onOpenChange={setShowLogin}>
                    <DialogTrigger asChild>
                      <Button variant="outline">Login</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Login to Your Account</DialogTitle>
                        <DialogDescription>
                          Enter your credentials to access your bookings
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleLogin} className="space-y-4">
                        <Input
                          type="email"
                          placeholder="Email"
                          value={loginForm.email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLoginForm(prev => ({ ...prev, email: e.target.value }))
                          }
                          required
                        />
                        <Input
                          type="password"
                          placeholder="Password"
                          value={loginForm.password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLoginForm(prev => ({ ...prev, password: e.target.value }))
                          }
                          required
                        />
                        <Button type="submit" className="w-full">Login</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  
                  <Dialog open={showRegister} onOpenChange={setShowRegister}>
                    <DialogTrigger asChild>
                      <Button>Sign Up</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Your Account</DialogTitle>
                        <DialogDescription>
                          Join us to book your perfect stay
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="First Name"
                            value={registerForm.first_name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setRegisterForm(prev => ({ ...prev, first_name: e.target.value }))
                            }
                            required
                          />
                          <Input
                            placeholder="Last Name"
                            value={registerForm.last_name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setRegisterForm(prev => ({ ...prev, last_name: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <Input
                          type="email"
                          placeholder="Email"
                          value={registerForm.email}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRegisterForm(prev => ({ ...prev, email: e.target.value }))
                          }
                          required
                        />
                        <Input
                          type="password"
                          placeholder="Password (min 8 characters)"
                          value={registerForm.password}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRegisterForm(prev => ({ ...prev, password: e.target.value }))
                          }
                          required
                          minLength={8}
                        />
                        <Input
                          type="tel"
                          placeholder="Phone (optional)"
                          value={registerForm.phone || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRegisterForm(prev => ({ ...prev, phone: e.target.value || null }))
                          }
                        />
                        <Button type="submit" className="w-full">Create Account</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Tab Navigation */}
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none">
            <TabsTrigger value="search" className="flex items-center space-x-2">
              <Bed className="h-4 w-4" />
              <span className="hidden sm:inline">Search Rooms</span>
            </TabsTrigger>
            {currentUser && (
              <>
                <TabsTrigger value="bookings" className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">My Bookings</span>
                </TabsTrigger>
                <TabsTrigger value="notifications" className="flex items-center space-x-2 relative">
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Notifications</span>
                  {notifications.filter(n => n.status === 'pending').length > 0 && (
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                  )}
                </TabsTrigger>
                {(currentUser.role === 'admin' || currentUser.role === 'superuser') && (
                  <>
                    <TabsTrigger value="admin" className="flex items-center space-x-2">
                      <Settings className="h-4 w-4" />
                      <span className="hidden sm:inline">Admin Panel</span>
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span className="hidden sm:inline">Analytics</span>
                    </TabsTrigger>
                  </>
                )}
              </>
            )}
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CalendarDays className="h-5 w-5" />
                  <span>Find Your Perfect Room</span>
                </CardTitle>
                <CardDescription>
                  Search for available rooms at Hotel Toyo Purwokerto
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <Label>Check-in Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {format(searchParams.checkIn, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={searchParams.checkIn}
                          onSelect={(date: Date | undefined) => date && setSearchParams(prev => ({ ...prev, checkIn: date }))}
                          disabled={(date: Date) => date < new Date()}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label>Check-out Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {format(searchParams.checkOut, 'PPP')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent>
                        <Calendar
                          mode="single"
                          selected={searchParams.checkOut}
                          onSelect={(date: Date | undefined) => date && setSearchParams(prev => ({ ...prev, checkOut: date }))}
                          disabled={(date: Date) => date <= searchParams.checkIn}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div>
                    <Label>Guests</Label>
                    <Select value={searchParams.guests.toString() || '2'} onValueChange={(value: string) => setSearchParams(prev => ({ ...prev, guests: parseInt(value) }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map(num => (
                          <SelectItem key={num} value={num.toString()}>
                            <div className="flex items-center">
                              <Users className="mr-2 h-4 w-4" />
                              {num} {num === 1 ? 'Guest' : 'Guests'}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Room Type (Optional)</Label>
                    <Select value={searchParams.roomType || 'all'} onValueChange={(value: string) => setSearchParams(prev => ({ ...prev, roomType: value === 'all' ? '' : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Any Room Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any Room Type</SelectItem>
                        <SelectItem value="deluxe">🌟 Deluxe</SelectItem>
                        <SelectItem value="superior">✨ Superior</SelectItem>
                        <SelectItem value="junior_suite">👑 Junior Suite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button onClick={handleSearch} disabled={isSearching} className="w-full md:w-auto">
                  {isSearching ? 'Searching...' : 'Search Available Rooms'}
                </Button>
              </CardContent>
            </Card>

            {/* Available Rooms */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(availableRooms.length > 0 ? availableRooms : roomTypes).map((roomType: RoomType) => (
                <Card key={roomType.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-amber-100 flex items-center justify-center">
                    {roomType.image_urls.length > 0 ? (
                      <img src={roomType.image_urls[0]} alt={roomType.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <Bed className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">{roomType.name}</p>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold">{roomType.name}</h3>
                      <Badge variant={roomType.type === 'junior_suite' ? 'default' : 'secondary'}>
                        {roomType.type === 'deluxe' && '🌟 Deluxe'}
                        {roomType.type === 'superior' && '✨ Superior'}
                        {roomType.type === 'junior_suite' && '👑 Junior Suite'}
                      </Badge>
                    </div>
                    
                    {roomType.description && (
                      <p className="text-gray-600 text-sm mb-3">{roomType.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">Max {roomType.max_occupancy} guests</span>
                      </div>
                      <div className="text-xl font-bold text-blue-600">
                        ${roomType.base_price}/night
                      </div>
                    </div>
                    
                    {roomType.amenities.length > 0 && (
                      <div className="mb-4">
                        <div className="flex flex-wrap gap-1">
                          {roomType.amenities.slice(0, 3).map((amenity: string, index: number) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                          {roomType.amenities.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{roomType.amenities.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      onClick={() => handleBookRoom(roomType)} 
                      className="w-full"
                      disabled={roomType.max_occupancy < searchParams.guests}
                    >
                      {roomType.max_occupancy < searchParams.guests ? 'Capacity Exceeded' : 'Book Now'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          {currentUser && (
            <TabsContent value="bookings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>My Bookings</CardTitle>
                  <CardDescription>
                    View and manage your hotel reservations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userBookings.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No bookings yet. Start by searching for rooms!</p>
                      <Button onClick={() => setActiveTab('search')} className="mt-4">
                        Search Rooms
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {userBookings.map((booking: Booking) => (
                        <Card key={booking.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-semibold">Booking #{booking.id}</h3>
                                <p className="text-sm text-gray-600">
                                  {format(booking.check_in_date, 'PPP')} - {format(booking.check_out_date, 'PPP')}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {booking.guests} guests • ${booking.total_amount}
                                </p>
                                {booking.special_requests && (
                                  <p className="text-sm text-gray-500 mt-1">
                                    Special requests: {booking.special_requests}
                                  </p>
                                )}
                              </div>
                              <div className="text-right">
                                <Badge 
                                  variant={
                                    booking.status === 'confirmed' ? 'default' :
                                    booking.status === 'pending' ? 'secondary' :
                                    booking.status === 'cancelled' ? 'destructive' :
                                    'outline'
                                  }
                                >
                                  {booking.status}
                                </Badge>
                                <p className="text-xs text-gray-500 mt-1">
                                  Created: {format(booking.created_at, 'PPp')}
                                </p>
                              
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Notifications Tab */}
          {currentUser && (
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Stay updated with your booking status and hotel information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {notifications.length === 0 ? (
                    <div className="text-center py-8">
                      <Bell className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No notifications yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {notifications.map((notification: Notification) => (
                        <Card key={notification.id} className={notification.status === 'pending' ? 'border-blue-200 bg-blue-50' : ''}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h3 className="font-semibold">{notification.title}</h3>
                                <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                  <span>Type: {notification.type}</span>
                                  <span>Status: {notification.status}</span>
                                  <span>{format(notification.created_at, 'PPp')}</span>
                                </div>
                              </div>
                              {notification.status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => trpc.markNotificationAsRead.mutate(notification.id)}
                                >
                                  Mark as read
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Admin Panel Tab */}
          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superuser') && (
            <TabsContent value="admin" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Room Type Management */}
                <Card>
                  <CardHeader>
                    <CardTitle>Create Room Type</CardTitle>
                    <CardDescription>Add new room types to the hotel</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateRoomType} className="space-y-4">
                      <Input
                        placeholder="Room Type Name"
                        value={roomTypeForm.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setRoomTypeForm(prev => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                      
                      <Select value={roomTypeForm.type || 'deluxe'} onValueChange={(value: typeof roomTypeEnum._type) => setRoomTypeForm(prev => ({ ...prev, type: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="deluxe">🌟 Deluxe</SelectItem>
                          <SelectItem value="superior">✨ Superior</SelectItem>
                          <SelectItem value="junior_suite">👑 Junior Suite</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Textarea
                        placeholder="Description (optional)"
                        value={roomTypeForm.description || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setRoomTypeForm(prev => ({ ...prev, description: e.target.value || null }))
                        }
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          type="number"
                          placeholder="Base Price"
                          value={roomTypeForm.base_price}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRoomTypeForm(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))
                          }
                          required
                          min="0"
                          step="0.01"
                        />
                        <Input
                          type="number"
                          placeholder="Max Occupancy"
                          value={roomTypeForm.max_occupancy}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setRoomTypeForm(prev => ({ ...prev, max_occupancy: parseInt(e.target.value) || 0 }))
                          }
                          required
                          min="1"
                        />
                      </div>
                      
                      {/* Amenities */}
                      <div>
                        <Label>Amenities</Label>
                        <div className="flex space-x-2 mt-1">
                          <Input
                            placeholder="Add amenity"
                            value={newAmenity}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewAmenity(e.target.value)}
                          />
                          <Button type="button" onClick={addAmenity} size="sm">
                            Add
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {roomTypeForm.amenities.map((amenity: string, index: number) => (
                            <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeAmenity(index)}>
                              {amenity} ×
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {/* Image URLs */}
                      <div>
                        <Label>Image URLs</Label>
                        <div className="flex space-x-2 mt-1">
                          <Input
                            placeholder="Add image URL"
                            value={newImageUrl}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewImageUrl(e.target.value)}
                          />
                          <Button type="button" onClick={addImageUrl} size="sm">
                            Add
                          </Button>
                        </div>
                        <div className="space-y-1 mt-2">
                          {roomTypeForm.image_urls.map((url: string, index: number) => (
                            <div key={index} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                              <span className="truncate">{url}</span>
                              <Button type="button" onClick={() => removeImageUrl(index)} size="sm" variant="ghost">
                                ×
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <Button type="submit" className="w-full">
                        Create Room Type
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Promotional Offers */}
                <Card>
                  <CardHeader>
                    <CardTitle>Create Promotional Offer</CardTitle>
                    <CardDescription>Add discount codes and special offers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreatePromoOffer} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="Promo Code"
                          value={promoForm.code}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPromoForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))
                          }
                          required
                        />
                        <Input
                          placeholder="Offer Name"
                          value={promoForm.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPromoForm(prev => ({ ...prev, name: e.target.value }))
                          }
                          required
                        />
                      </div>
                      
                      <Textarea
                        placeholder="Description (optional)"
                        value={promoForm.description || ''}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          setPromoForm(prev => ({ ...prev, description: e.target.value || null }))
                        }
                      />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Select value={promoForm.discount_type || 'percentage'} onValueChange={(value: 'percentage' | 'fixed') => setPromoForm(prev => ({ ...prev, discount_type: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage (%)</SelectItem>
                            <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Discount Value"
                          value={promoForm.discount_value}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPromoForm(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))
                          }
                          required
                          min="0"
                          step="0.01"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          type="number"
                          placeholder="Min Booking Amount (optional)"
                          value={promoForm.min_booking_amount || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPromoForm(prev => ({ ...prev, min_booking_amount: parseFloat(e.target.value) || null }))
                          }
                          min="0"
                          step="0.01"
                        />
                        <Input
                          type="number"
                          placeholder="Usage Limit (optional)"
                          value={promoForm.usage_limit || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPromoForm(prev => ({ ...prev, usage_limit: parseInt(e.target.value) || null }))
                          }
                          min="1"
                        />
                      </div>
                      
                      <Button type="submit" className="w-full">
                        <Percent className="mr-2 h-4 w-4" />
                        Create Promo Offer
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* All Bookings Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Booking Management</CardTitle>
                  <CardDescription>View and manage all hotel bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Booking ID</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Dates</TableHead>
                        <TableHead>Guests</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allBookings.map((booking: Booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>#{booking.id}</TableCell>
                          <TableCell>User {booking.user_id}</TableCell>
                          <TableCell>
                            {format(booking.check_in_date, 'MMM dd')} - {format(booking.check_out_date, 'MMM dd')}
                          </TableCell>
                          <TableCell>{booking.guests}</TableCell>
                          <TableCell>${booking.total_amount}</TableCell>
                          <TableCell>
                            <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-x-2">
                              <Button size="sm" variant="outline">View</Button>
                              {booking.status === 'pending' && (
                                <Button 
                                  size="sm" 
                                  onClick={() => trpc.updateBooking.mutate({ id: booking.id, status: 'confirmed' })}
                                >
                                  Confirm
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Analytics Tab */}
          {currentUser && (currentUser.role === 'admin' || currentUser.role === 'superuser') && (
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                        <p className="text-2xl font-bold">{dashboardStats?.totalBookings || 0}</p>
                      </div>
                      <BookOpen className="h-8 w-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                        <p className="text-2xl font-bold">${dashboardStats?.totalRevenue || 0}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
                        <p className="text-2xl font-bold">{dashboardStats?.occupancyRate || 0}%</p>
                      </div>
                      <BarChart3 className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Active Promotional Offers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {promoOffers.filter((promo: PromoOffer) => promo.is_active).map((promo: PromoOffer) => (
                      <Card key={promo.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">{promo.name}</h3>
                            <Badge>{promo.code}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{promo.description}</p>
                          <div className="flex items-center justify-between text-sm">
                            <span>
                              {promo.discount_type === 'percentage' ? `${promo.discount_value}% off` : `$${promo.discount_value} off`}
                            </span>
                            <span>Used: {promo.used_count}/{promo.usage_limit || '∞'}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Valid until: {format(promo.valid_until, 'PPP')}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        {/* Booking Modal */}
        <Dialog open={!!selectedRoom} onOpenChange={(open: boolean) => !open && setSelectedRoom(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Book {selectedRoom?.name}</DialogTitle>
              <DialogDescription>
                Complete your reservation for {selectedRoom?.name}
              </DialogDescription>
            </DialogHeader>
            
            {selectedRoom && (
              <div className="space-y-6">
                {/* Booking Summary */}
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Booking Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Check-in:</span>
                        <span>{format(searchParams.checkIn, 'PPP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Check-out:</span>
                        <span>{format(searchParams.checkOut, 'PPP')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Guests:</span>
                        <span>{searchParams.guests}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Nights:</span>
                        <span>{Math.ceil((searchParams.checkOut.getTime() - searchParams.checkIn.getTime()) / (1000 * 60 * 60 * 24))}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total Amount:</span>
                        <span>${selectedRoom.base_price * Math.ceil((searchParams.checkOut.getTime() - searchParams.checkIn.getTime()) / (1000 * 60 * 60 * 24))}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Special Requests */}
                <div>
                  <Label>Special Requests (Optional)</Label>
                  <Textarea
                    placeholder="Any special requests or preferences..."
                    value={bookingForm.specialRequests}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setBookingForm(prev => ({ ...prev, specialRequests: e.target.value }))
                    }
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <Label>Payment Method</Label>
                  <Select value={selectedPayment || 'credit_card'} onValueChange={(value: typeof paymentMethodEnum._type) => setSelectedPayment(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">💳 Credit Card</SelectItem>
                      <SelectItem value="bank_transfer">🏦 Bank Transfer</SelectItem>
                      <SelectItem value="paypal">📱 PayPal</SelectItem>
                      <SelectItem value="e_wallet">💰 E-Wallet</SelectItem>
                      <SelectItem value="cash_on_arrival">💵 Cash on Arrival</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Credit Card Form */}
                {selectedPayment === 'credit_card' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Credit Card Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Input
                        placeholder="Card Number"
                        value={paymentForm.cardNumber}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPaymentForm(prev => ({ ...prev, cardNumber: e.target.value }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          placeholder="MM/YY"
                          value={paymentForm.expiryDate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPaymentForm(prev => ({ ...prev, expiryDate: e.target.value }))
                          }
                        />
                        <Input
                          placeholder="CVV"
                          value={paymentForm.cvv}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setPaymentForm(prev => ({ ...prev, cvv: e.target.value }))
                          }
                        />
                      </div>
                      <Input
                        placeholder="Cardholder Name"
                        value={paymentForm.cardName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPaymentForm(prev => ({ ...prev, cardName: e.target.value }))
                        }
                      />
                    </CardContent>
                  </Card>
                )}

                <div className="flex space-x-3">
                  <Button variant="outline" onClick={() => setSelectedRoom(null)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateBooking} disabled={isBooking} className="flex-1">
                    <CreditCard className="mr-2 h-4 w-4" />
                    {isBooking ? 'Processing...' : 'Confirm Booking'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default App;
