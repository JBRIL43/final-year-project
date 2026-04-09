import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<UserCredential> studentLogin(String email, String password) async {
    return _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  Future<UserCredential> financeLogin(String email, String password) async {
    return _auth.signInWithEmailAndPassword(email: email, password: password);
  }
}
