package sample;

import client.ClientConnexion;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.image.Image;
import javafx.scene.image.ImageView;
import javafx.scene.layout.HBox;
import javafx.scene.layout.VBox;

import javax.swing.*;
import java.beans.EventHandler;
import java.io.File;
import java.util.ArrayList;
import java.util.concurrent.atomic.AtomicInteger;

public class PartieController {

    @FXML
    private HBox main;
    @FXML
    private Button play;
    @FXML
    private Button take;
    @FXML
    private Button refuse;
    @FXML
    private HBox boxRois;
    @FXML
    private HBox boxChien;
    @FXML
    private HBox boxTour;
    @FXML
    private Button launch;
    @FXML
    private Button playTour;
    @FXML
    private Button endTour;
    @FXML
    private ImageView carteCenter;
    @FXML
    private ImageView dog;
    @FXML
    private Label tourLabel;

    public void play() throws InterruptedException {
        ArrayList<Object> waitsAnswer = new ArrayList<>();
        int currentNumJoueur = -1;
        String hasTake = "";
        int numPlayerTake = -1;
        while(currentNumJoueur != Integer.parseInt(AccueilController.numJoueur) && !hasTake.equals("TAKE")) {
            waitsAnswer.add("WAITANSWER");
            ClientConnexion client3 = new ClientConnexion(ConnexionController.host,3333,waitsAnswer);
            ArrayList<Object> datas3 = client3.run();
            currentNumJoueur = (int) datas3.get(0);
            hasTake = (String) datas3.get(1);
            numPlayerTake = (int) datas3.get(2);

            if(currentNumJoueur == Integer.parseInt(AccueilController.numJoueur) && !hasTake.equals("TAKE")) {
                JOptionPane.showMessageDialog(null,"A votre tour !");
                take.setVisible(true);
                refuse.setVisible(true);
            }
            else if(hasTake.equals("TAKE")) {
                JOptionPane.showMessageDialog(null,"Joueur " + numPlayerTake + " a pris le chien");
                take(numPlayerTake);
            } else {
                JOptionPane.showMessageDialog(null,"En attente du joueur " + currentNumJoueur);
            }


        }

            play.setVisible(false);

    }

    public void playWithDog() throws InterruptedException {
        ArrayList<Object> chiens = new ArrayList<>();
        chiens.add("CHIEN");
        chiens.add(ConnexionController.idUser);

        ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,chiens);
        ArrayList<Object> datas2 = client2.run();
        refuse.setVisible(false);
        take.setVisible(false);
        play();
    }

    public void playWithoutDog() throws InterruptedException {
        ArrayList<Object> refuses = new ArrayList<>();
        refuses.add("REFUSE");
        refuses.add(ConnexionController.idUser);

        ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,refuses);
        ArrayList<Object> datas2 = client2.run();
        refuse.setVisible(false);
        take.setVisible(false);
        play();
    }

    public void take(int numPlayerTake) {
        if(numPlayerTake == Integer.parseInt(AccueilController.numJoueur)){
            carteCenter.setVisible(false);
            ArrayList<Object> rois = new ArrayList<>();
            rois.add("ROIS");
            rois.add(ConnexionController.idUser);
            ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,rois);
            ArrayList<Object> datas = client2.run();
            ArrayList<String> idCartes = (ArrayList<String>) datas.get(0);
            ArrayList<String> lienCartes = (ArrayList<String>) datas.get(1);
            boxRois.setSpacing(20);
            for(int i = 0; i < idCartes.size() ; i++) {
                    ImageView imageRoi = new ImageView(new Image("/sample/img/" + lienCartes.get(i)));
                    int finalI = i;
                    imageRoi.addEventHandler(javafx.scene.input.MouseEvent.MOUSE_CLICKED, event -> {
                        callKing(idCartes.get(finalI));
                    });
                    boxRois.getChildren().add(imageRoi);
            }
        } else {
            ArrayList<Object> waitcalls = new ArrayList<>();
            waitcalls.add("WAITCALL");
            waitcalls.add(ConnexionController.idUser);
            boolean callsDone = false;
            while(callsDone == false) {
                ClientConnexion client2 = new ClientConnexion(ConnexionController.host,3333,waitcalls);
                ArrayList<Object> datas2 = client2.run();
                callsDone = (boolean) datas2.get(0);
                if(callsDone == true) {
                    //boxRois.getChildren().clear();
                    JOptionPane.showMessageDialog(null,"Le Roi de "+ datas2.get(3) +" a \u00e9t\u00e9 appel\u00e9 !");
                    ArrayList<Integer> idCartes = (ArrayList) datas2.get(1);
                    ArrayList<String> lienCartes = (ArrayList) datas2.get(2);
                    for(int i = 0; i < idCartes.size() ; i++) {
                        ImageView imageChien = new ImageView(new Image("/sample/img/" + lienCartes.get(i)));
                        boxChien.getChildren().add(imageChien);
                    }
                    carteCenter.setVisible(false);
                    launch.setVisible(true);
                } else {
                    JOptionPane.showMessageDialog(null,"Appel du Roi en cours !");
                }

            }
        }
    }
    public void callKing(String idCarte) {
        boxRois.getChildren().clear();
        boxRois.setSpacing(20);
        boxChien.setSpacing(20);
        ArrayList<Object> calls = new ArrayList<>();
        calls.add("CALL");
        calls.add(Integer.parseInt(idCarte));
        calls.add(ConnexionController.idUser);
        ClientConnexion client3 = new ClientConnexion(ConnexionController.host,3333,calls);
        ArrayList<Object> datas2 = client3.run();
        ArrayList<Integer> idCartesChien = (ArrayList) datas2.get(0);
        ArrayList<String> lienCartesChien = (ArrayList) datas2.get(1);
        for(int j = 0; j < idCartesChien.size() ; j++) {
            ImageView imageChien = new ImageView(new Image("/sample/img/" + lienCartesChien.get(j), 40,60,false,false));
            imageChien.setId(idCartesChien.get(j).toString());
            boxChien.getChildren().add(imageChien);

            main.getChildren().add(imageChien);
        }
        for(int i = 0; i< main.getChildren().size() ; i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> addDogs = new ArrayList<>();
                addDogs.add("ADDDOG");
                addDogs.add(imageCarte.getId());
                ClientConnexion client4 = new ClientConnexion(ConnexionController.host,3333,addDogs);
                ArrayList<Object> datas3 = client4.run();
                boolean dogDone = (boolean) datas3.get(0);
                String ok = (String) datas3.get(1);

                if(ok.equals("OK")) {
                    main.getChildren().remove(imageCarte);
                    boxChien.getChildren().add(new ImageView(imageCarte.getImage()));
                    if(dogDone == true) {
                        launch.setVisible(true);
                        for(int j = 0; j< main.getChildren().size() ; j++) {
                            ImageView imageCarte1 = (ImageView) main.getChildren().get(j);
                            imageCarte1.setDisable(true);
                        }
                    }
                }
                else {
                    JOptionPane.showMessageDialog(null,"Mauvaise carte dans le chien !");
                }

            });
        }

    }

    public void launch() throws InterruptedException {
        launch.setVisible(false);
        boxChien.setVisible(false);
        ArrayList<Object> waitdog = new ArrayList<>();
        waitdog.add("WAITDOG");
        waitdog.add(ConnexionController.idUser);
        boolean dogDone = false;
        while (dogDone == false) {
            ClientConnexion client2 = new ClientConnexion("79.94.239.225", 3333, waitdog);
            ArrayList<Object> datas2 = client2.run();
            dogDone = (boolean) datas2.get(0);
            if (dogDone == true) {
                playTour.setVisible(true);
            } else {
                JOptionPane.showMessageDialog(null, "En attente que le joueur fasse son chien !");
            }
        }
    }
    public void playTour() {
        playTour.setVisible(false);
        ArrayList<Object> begins = new ArrayList<>();
        begins.add("BEGIN");
        ClientConnexion client1 = new ClientConnexion(ConnexionController.host,3333,begins);
        client1.run();

        ArrayList<Object> waitTours = new ArrayList<>();
        int currentJoueurTour = -1;
        boolean finTour = false;
        boolean finPartie = false;
        ArrayList<String> idCartes= new ArrayList<>();
        ArrayList<String> lienCartes= new ArrayList<>();
        while(currentJoueurTour != Integer.parseInt(AccueilController.numJoueur) && finTour == false && finPartie == false) {
            waitTours.add("WAITTOUR");
            ClientConnexion client3 = new ClientConnexion(ConnexionController.host, 3333, waitTours);
            ArrayList<Object> datas3 = client3.run();
            currentJoueurTour = (int) datas3.get(0);
            finTour = (boolean) datas3.get(1);
            finPartie = (boolean) datas3.get(2);
            idCartes = (ArrayList<String>) datas3.get(3);
            lienCartes = (ArrayList<String>) datas3.get(4);

            if (currentJoueurTour == Integer.parseInt(AccueilController.numJoueur) && finTour == false && finPartie == false) {
                JOptionPane.showMessageDialog(null, "A votre tour !");
                if (!idCartes.isEmpty()) {
//                    VBox boxCarte = new VBox();
                    for (int i = 0; i < idCartes.size(); i++) {
//                        boxCarte.getChildren().clear();
//                        boxCarte.getChildren().add(new Label("Joueur " + currentJoueurTour));
//                        boxCarte.getChildren().add(new ImageView(new Image("/sample/img/" + lienCartes.get(i))));
                        boxTour.getChildren().add(new ImageView(new Image("/sample/img/" + lienCartes.get(i))));
                    }
                }

            }
            else if(finTour == true && finPartie == false) {
                ArrayList<Object> endTours = new ArrayList<>();
                endTours.add("FINTOUR");
                ClientConnexion client4 = new ClientConnexion(ConnexionController.host, 3333, endTours);
                ArrayList<Object> datas4 = client4.run();
                playTour.setVisible(true);
                JOptionPane.showMessageDialog(null,"Le tour est fini !");
                boxTour.getChildren().clear();
                if (!idCartes.isEmpty()) {
                    for (int i = 0; i < idCartes.size(); i++) {
                        boxTour.getChildren().add(new ImageView(new Image("/sample/img/" + lienCartes.get(i))));
                    }
                }
            }
            else if(finPartie == true) {
                JOptionPane.showMessageDialog(null,"La partie est finie !");
            } else {
                JOptionPane.showMessageDialog(null,"Au tour du Joueur " + currentJoueurTour);
            }
        }

        for(int i = 0; i< main.getChildren().size() ; i++) {
            ImageView imageCarte = (ImageView) main.getChildren().get(i);
            imageCarte.setDisable(false);
            int finalI = i;
            imageCarte.setOnMouseClicked((e) -> {
                ArrayList<Object> playTours = new ArrayList<>();
                playTours.add("PLAYTOUR");
                playTours.add(imageCarte.getId());
                playTours.add(ConnexionController.idUser);
                playTours.add(finalI +1);
                ClientConnexion client = new ClientConnexion(ConnexionController.host,3333,playTours);
                ArrayList<Object> datas = client.run();
                boolean hasError = (boolean) datas.get(0);
                if(hasError == false) {
                    main.getChildren().remove(imageCarte);
                    ImageView img = new ImageView(imageCarte.getImage());
                    img.setFitWidth(62);
                    img.setFitHeight(84);
                    boxTour.getChildren().add(img);
                    endTour.setVisible(true);
                }
                else {
                    JOptionPane.showMessageDialog(null,"Carte non valide !");
                }
            });
        }


    }

    public void endTour() {
        playTour();
        endTour.setVisible(false);
    }


}
